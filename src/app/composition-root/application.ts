import type { Logger } from "pino";
import { fileURLToPath } from "node:url";

import { AccountRegistrationService } from "../../application/accounts/registration.js";
import { SessionService } from "../../application/sessions/service.js";
import type {
  BalancingLoader,
  LoadedBalancingConfiguration,
} from "../../application/balancing/loader.js";
import type { ReadinessProbe } from "../../application/health/readiness.js";
import { FileSystemBalancingLoader } from "../../infrastructure/balancing/loader.js";
import { KyselyAccountRepository } from "../../infrastructure/accounts/repository.js";
import {
  Argon2PasswordHasher,
  DUMMY_PASSWORD_HASH,
} from "../../infrastructure/accounts/password-hasher.js";
import { KyselySessionRepository } from "../../infrastructure/sessions/repository.js";
import { OpaqueSessionTokenGenerator } from "../../infrastructure/sessions/token-generator.js";
import type { RuntimeConfig } from "../../infrastructure/config/config.js";
import {
  createPostgresDatabase,
  type PostgresDatabase,
} from "../../infrastructure/database/database.js";
import { PostgresReadinessProbe } from "../../infrastructure/database/readiness.js";
import { createLogger, redactedConfig } from "../../infrastructure/logging/logger.js";
import { SystemWallClock } from "../../infrastructure/runtime/clocks.js";
import { NodeCryptographicRandomSource } from "../../infrastructure/runtime/random.js";
import { PrefixedIdGenerator } from "../../infrastructure/runtime/ids.js";
import { createServer, type ServerDependencies } from "./server.js";

export interface ShutdownResource {
  close(): Promise<void>;
}

export interface ApplicationDependencies {
  readonly logger?: Logger;
  readonly readinessProbe?: ReadinessProbe;
  readonly balancingLoader?: BalancingLoader;
  readonly database?: PostgresDatabase;
  readonly accountRegistration?: Pick<AccountRegistrationService, "register">;
  readonly sessionService?: Pick<SessionService, "create" | "current" | "revoke" | "authenticate">;
  readonly resources?: readonly ShutdownResource[];
}

export interface ServerApplication {
  readonly logger: Logger;
  readonly server: ReturnType<typeof createServer>;
  readonly database: PostgresDatabase | undefined;
  readonly balancingConfiguration: LoadedBalancingConfiguration | undefined;
  start(): Promise<void>;
  shutdown(reason?: string): Promise<void>;
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutOperation = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("Shutdown timed out")), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutOperation]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function createApplication(
  config: RuntimeConfig,
  dependencies: ApplicationDependencies = {},
): ServerApplication {
  const logger = dependencies.logger ?? createLogger(config);
  const database =
    config.databaseUrl === undefined
      ? undefined
      : (dependencies.database ?? createPostgresDatabase(config));
  const resources = [
    ...(dependencies.resources ?? []),
    ...(database === undefined ? [] : [database]),
  ];
  const balancingLoader =
    dependencies.balancingLoader ??
    new FileSystemBalancingLoader(
      fileURLToPath(new URL("../../../data/balancing/manifest.json", import.meta.url)),
    );
  const readinessProbe =
    dependencies.readinessProbe ??
    (database === undefined ? undefined : new PostgresReadinessProbe(database));
  const accountRegistration =
    dependencies.accountRegistration ??
    (database === undefined
      ? undefined
      : new AccountRegistrationService({
          repository: new KyselyAccountRepository(database.db),
          passwordHasher: new Argon2PasswordHasher(),
          idGenerator: new PrefixedIdGenerator(new NodeCryptographicRandomSource()),
          wallClock: new SystemWallClock(),
        }));
  const sessionService =
    dependencies.sessionService ??
    (database === undefined
      ? undefined
      : new SessionService({
          accountReader: new KyselyAccountRepository(database.db),
          passwordHasher: new Argon2PasswordHasher(),
          sessionRepository: new KyselySessionRepository(database.db),
          tokenGenerator: new OpaqueSessionTokenGenerator(new NodeCryptographicRandomSource()),
          idGenerator: new PrefixedIdGenerator(new NodeCryptographicRandomSource()),
          wallClock: new SystemWallClock(),
          sessionLifetimeMs: config.sessionLifetimeMs,
          dummyPasswordHash: DUMMY_PASSWORD_HASH,
        }));
  const serverDependencies: ServerDependencies = {
    logger,
    ...(readinessProbe === undefined ? {} : { readinessProbe }),
    ...(accountRegistration === undefined ? {} : { accountRegistration }),
    ...(sessionService === undefined ? {} : { sessionService }),
  };
  const server = createServer(config, serverDependencies);
  let started = false;
  let shutdownPromise: Promise<void> | undefined;
  let balancingConfiguration: LoadedBalancingConfiguration | undefined;

  logger.info(
    { component: "configuration", config: redactedConfig(config) },
    "runtime configuration loaded",
  );

  const start = async (): Promise<void> => {
    if (started) return;

    balancingConfiguration = await balancingLoader.load();
    logger.info(
      {
        component: "balancing",
        balancingVersion: balancingConfiguration.balancingVersion,
        catalogVersion: balancingConfiguration.catalogVersion,
        balancingHash: balancingConfiguration.hash,
      },
      "balancing configuration loaded",
    );
    await server.listen({ host: config.host, port: config.port });
    started = true;
    logger.info({ component: "lifecycle", host: config.host, port: config.port }, "server started");
  };

  const shutdown = (reason = "manual"): Promise<void> => {
    if (shutdownPromise !== undefined) return shutdownPromise;

    shutdownPromise = (async () => {
      const errors: unknown[] = [];
      logger.info({ component: "lifecycle", reason }, "server shutdown started");

      try {
        await withTimeout(server.close(), config.shutdownTimeoutMs);
      } catch (error) {
        errors.push(error);
      }

      for (const resource of resources) {
        try {
          await withTimeout(resource.close(), config.shutdownTimeoutMs);
        } catch (error) {
          errors.push(error);
        }
      }

      if (errors.length > 0) {
        throw new AggregateError(errors, "Graceful shutdown failed");
      }

      logger.info({ component: "lifecycle", reason }, "server shutdown completed");
    })();

    return shutdownPromise;
  };

  return {
    logger,
    server,
    database,
    get balancingConfiguration() {
      return balancingConfiguration;
    },
    start,
    shutdown,
  };
}

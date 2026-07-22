import type { Logger } from "pino";

import type { ReadinessProbe } from "../../application/health/readiness.js";
import type { RuntimeConfig } from "../../infrastructure/config/config.js";
import { createLogger, redactedConfig } from "../../infrastructure/logging/logger.js";
import { createServer, type ServerDependencies } from "./server.js";

export interface ShutdownResource {
  close(): Promise<void>;
}

export interface ApplicationDependencies {
  readonly logger?: Logger;
  readonly readinessProbe?: ReadinessProbe;
  readonly resources?: readonly ShutdownResource[];
}

export interface ServerApplication {
  readonly logger: Logger;
  readonly server: ReturnType<typeof createServer>;
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
  const resources = dependencies.resources ?? [];
  const serverDependencies: ServerDependencies =
    dependencies.readinessProbe === undefined
      ? { logger }
      : { logger, readinessProbe: dependencies.readinessProbe };
  const server = createServer(config, serverDependencies);
  let started = false;
  let shutdownPromise: Promise<void> | undefined;

  logger.info(
    { component: "configuration", config: redactedConfig(config) },
    "runtime configuration loaded",
  );

  const start = async (): Promise<void> => {
    if (started) return;

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

  return { logger, server, start, shutdown };
}

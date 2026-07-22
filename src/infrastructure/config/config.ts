import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const logLevels = [
  Type.Literal("fatal"),
  Type.Literal("error"),
  Type.Literal("warn"),
  Type.Literal("info"),
  Type.Literal("debug"),
  Type.Literal("trace"),
  Type.Literal("silent"),
];

export const runtimeConfigSchema = Type.Object({
  host: Type.String({ minLength: 1 }),
  port: Type.Integer({ minimum: 1, maximum: 65535 }),
  logLevel: Type.Union(logLevels),
  serviceName: Type.String({ minLength: 1 }),
  shutdownTimeoutMs: Type.Integer({ minimum: 1, maximum: 60000 }),
  maxBodyBytes: Type.Integer({ minimum: 1, maximum: 10485760 }),
  requestTimeoutMs: Type.Integer({ minimum: 1, maximum: 120000 }),
  connectionTimeoutMs: Type.Integer({ minimum: 1, maximum: 120000 }),
  databasePoolMax: Type.Integer({ minimum: 1, maximum: 100 }),
  databaseIdleTimeoutMs: Type.Integer({ minimum: 0, maximum: 600000 }),
  databaseConnectionTimeoutMs: Type.Integer({ minimum: 1, maximum: 120000 }),
  sessionLifetimeMs: Type.Integer({ minimum: 1, maximum: 31536000000 }),
  databaseUrl: Type.Optional(Type.String({ minLength: 1 })),
});

export type RuntimeConfig = Readonly<Static<typeof runtimeConfigSchema>>;
type Environment = Readonly<Record<string, string | undefined>>;

export class ConfigurationError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid runtime configuration: ${issues.join("; ")}`);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}

function parseInteger(value: string | undefined, fallback?: number): number | string | undefined {
  if (value === undefined) return fallback;

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
}

function configurationCandidate(environment: Environment): Record<string, unknown> {
  const databaseUrl = environment.GALAXIS_DATABASE_URL;

  return {
    host: environment.GALAXIS_HOST ?? "127.0.0.1",
    port: parseInteger(environment.GALAXIS_PORT),
    logLevel: environment.GALAXIS_LOG_LEVEL,
    serviceName: environment.GALAXIS_SERVICE_NAME ?? "galaxis-server",
    shutdownTimeoutMs: parseInteger(environment.GALAXIS_SHUTDOWN_TIMEOUT_MS, 10000),
    maxBodyBytes: parseInteger(environment.GALAXIS_MAX_BODY_BYTES, 1048576),
    requestTimeoutMs: parseInteger(environment.GALAXIS_REQUEST_TIMEOUT_MS, 30000),
    connectionTimeoutMs: parseInteger(environment.GALAXIS_CONNECTION_TIMEOUT_MS, 30000),
    databasePoolMax: parseInteger(environment.GALAXIS_DATABASE_POOL_MAX, 10),
    databaseIdleTimeoutMs: parseInteger(environment.GALAXIS_DATABASE_IDLE_TIMEOUT_MS, 10000),
    databaseConnectionTimeoutMs: parseInteger(
      environment.GALAXIS_DATABASE_CONNECTION_TIMEOUT_MS,
      5000,
    ),
    sessionLifetimeMs: parseInteger(environment.GALAXIS_SESSION_LIFETIME_MS, 604800000),
    ...(databaseUrl === undefined ? {} : { databaseUrl }),
  };
}

export function loadConfig(environment: Environment = process.env): RuntimeConfig {
  const candidate = configurationCandidate(environment);
  const issues = [...Value.Errors(runtimeConfigSchema, candidate)].map((error) => {
    const field = error.path.replace(/^\//u, "") || "configuration";
    return `${field}: ${error.message}`;
  });

  if (issues.length > 0) {
    throw new ConfigurationError(issues);
  }

  return Object.freeze(candidate) as RuntimeConfig;
}

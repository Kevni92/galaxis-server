import pino, { type DestinationStream, type Logger } from "pino";

import type { RuntimeConfig } from "../config/config.js";

export function redactedConfig(config: RuntimeConfig): {
  host: string;
  port: number;
  logLevel: RuntimeConfig["logLevel"];
  serviceName: string;
  shutdownTimeoutMs: number;
  maxBodyBytes: number;
  requestTimeoutMs: number;
  connectionTimeoutMs: number;
} {
  return {
    host: config.host,
    port: config.port,
    logLevel: config.logLevel,
    serviceName: config.serviceName,
    shutdownTimeoutMs: config.shutdownTimeoutMs,
    maxBodyBytes: config.maxBodyBytes,
    requestTimeoutMs: config.requestTimeoutMs,
    connectionTimeoutMs: config.connectionTimeoutMs,
  };
}

export function createLogger(config: RuntimeConfig, destination?: DestinationStream): Logger {
  const options = {
    level: config.logLevel,
    base: {
      component: "galaxis-server",
      service: config.serviceName,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "config.databaseUrl",
        "databaseUrl",
        "password",
        "*.password",
        "**.password",
        "token",
        "*.token",
        "**.token",
      ],
      censor: "[REDACTED]",
    },
  };

  return destination === undefined ? pino(options) : pino(options, destination);
}

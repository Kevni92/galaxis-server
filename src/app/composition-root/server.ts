import { randomUUID } from "node:crypto";

import Fastify from "fastify";
import type { Logger } from "pino";

import {
  NoExternalDependenciesReadinessProbe,
  type ReadinessProbe,
} from "../../application/health/readiness.js";
import type { RuntimeConfig } from "../../infrastructure/config/config.js";
import { createLogger } from "../../infrastructure/logging/logger.js";
import { registerHealthRoutes } from "../../transport/http/health-routes.js";

export interface ServerDependencies {
  readonly logger?: Logger;
  readonly readinessProbe?: ReadinessProbe;
}

function correlationId(request: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const header = request.headers["x-correlation-id"];
  if (typeof header === "string" && header.length > 0) return header;
  if (Array.isArray(header) && header[0]) return header[0];
  return `cor_${randomUUID()}`;
}

export function createServer(config: RuntimeConfig, dependencies: ServerDependencies = {}) {
  const logger = dependencies.logger ?? createLogger(config);
  const readinessProbe = dependencies.readinessProbe ?? new NoExternalDependenciesReadinessProbe();
  const server = Fastify({
    loggerInstance: logger,
    requestIdHeader: "x-correlation-id",
    genReqId: correlationId,
  });

  server.addHook("onRequest", async (request) => {
    request.log.info({ component: "http", correlationId: request.id }, "request received");
  });
  registerHealthRoutes(server, readinessProbe);

  return server;
}

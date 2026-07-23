import { randomUUID } from "node:crypto";

import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import type { Logger } from "pino";

import type { AccountRegistrationService } from "../../application/accounts/registration.js";
import type { CampaignService } from "../../application/campaigns/service.js";
import type { SessionService } from "../../application/sessions/service.js";
import {
  NoExternalDependenciesReadinessProbe,
  type ReadinessProbe,
} from "../../application/health/readiness.js";
import type { RuntimeConfig } from "../../infrastructure/config/config.js";
import { createLogger } from "../../infrastructure/logging/logger.js";
import { registerErrorHandling } from "../../transport/http/error-handler.js";
import { registerAuthRoutes } from "../../transport/http/auth-routes.js";
import { registerSessionRoutes } from "../../transport/http/session-routes.js";
import { registerHealthRoutes } from "../../transport/http/health-routes.js";
import { registerCampaignRoutes } from "../../transport/http/campaign-routes.js";

export interface ServerDependencies {
  readonly logger?: Logger;
  readonly readinessProbe?: ReadinessProbe;
  readonly accountRegistration?: Pick<AccountRegistrationService, "register">;
  readonly campaignService?: Pick<CampaignService, "create" | "list" | "get">;
  readonly sessionService?: Pick<SessionService, "create" | "current" | "revoke" | "authenticate">;
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
    bodyLimit: config.maxBodyBytes,
    requestTimeout: config.requestTimeoutMs,
    connectionTimeout: config.connectionTimeoutMs,
  }).withTypeProvider<TypeBoxTypeProvider>();

  server.decorateRequest("authIdentity", null);
  registerErrorHandling(server);
  server.addHook("onRequest", async (request) => {
    request.log.info({ component: "http", correlationId: request.id }, "request received");
  });
  registerHealthRoutes(server, readinessProbe);
  if (dependencies.accountRegistration !== undefined) {
    registerAuthRoutes(server, dependencies.accountRegistration);
  }
  if (dependencies.sessionService !== undefined) {
    registerSessionRoutes(server, dependencies.sessionService);
  }
  if (dependencies.campaignService !== undefined && dependencies.sessionService !== undefined) {
    registerCampaignRoutes(server, dependencies.campaignService, dependencies.sessionService);
  }

  return server;
}

// Feature: GAL-AUTH-SESSION-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import type { FastifyRequest, preHandlerHookHandler } from "fastify";

import type { AuthenticatedIdentity, SessionService } from "../../application/sessions/service.js";

declare module "fastify" {
  interface FastifyRequest {
    authIdentity: AuthenticatedIdentity | null;
  }
}

export function readBearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") return "";
  const match = /^Bearer\s+(\S+)$/u.exec(authorization);
  return match?.[1] ?? "";
}

/** Authenticates a future protected route and exposes only the confirmed identity. */
export function authenticateSession(
  sessionService: Pick<SessionService, "authenticate">,
): preHandlerHookHandler {
  return async (request) => {
    request.authIdentity = await sessionService.authenticate(readBearerToken(request));
  };
}

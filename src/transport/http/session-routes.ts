// Feature: GAL-AUTH-SESSION-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { Type, type Static } from "@sinclair/typebox";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify/types/utils.js";

import type { SessionService } from "../../application/sessions/service.js";
import { errorResponseSchema } from "./error-handler.js";
import { readBearerToken } from "./auth-hook.js";

const sessionCredentialsRequest = Type.Object({
  email: Type.String({ minLength: 1, format: "email" }),
  password: Type.String({ minLength: 1, format: "password", writeOnly: true }),
});
type SessionCredentialsRequest = Static<typeof sessionCredentialsRequest>;

const sessionCreatedResponse = Type.Object({
  sessionId: Type.String({ minLength: 1 }),
  accountId: Type.String({ minLength: 1 }),
  email: Type.String({ minLength: 1, format: "email" }),
  token: Type.String({ minLength: 1 }),
  createdAt: Type.String({ format: "date-time" }),
  expiresAt: Type.String({ format: "date-time" }),
});

const sessionResponse = Type.Object({
  sessionId: Type.String({ minLength: 1 }),
  accountId: Type.String({ minLength: 1 }),
  email: Type.String({ minLength: 1, format: "email" }),
  createdAt: Type.String({ format: "date-time" }),
  expiresAt: Type.String({ format: "date-time" }),
});

export function registerSessionRoutes<Logger extends FastifyBaseLogger>(
  server: FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    Logger
  >,
  sessionService: Pick<SessionService, "create" | "current" | "revoke">,
): void {
  server.post(
    "/api/v1/auth/sessions",
    {
      schema: {
        body: sessionCredentialsRequest,
        response: {
          201: sessionCreatedResponse,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await sessionService.create({
        ...(request.body as SessionCredentialsRequest),
        rateLimitKey: request.ip,
      });
      return reply.code(201).send(result);
    },
  );

  server.get(
    "/api/v1/auth/session",
    {
      schema: {
        response: {
          200: sessionResponse,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request) => sessionService.current(readBearerToken(request)),
  );

  server.delete(
    "/api/v1/auth/sessions/current",
    {
      schema: {
        response: {
          204: Type.Null(),
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await sessionService.revoke(readBearerToken(request));
      return reply.code(204).send();
    },
  );
}

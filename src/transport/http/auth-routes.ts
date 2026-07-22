// Feature: GAL-AUTH-ACCOUNT-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify/types/utils.js";

import type { AccountRegistrationService } from "../../application/accounts/registration.js";
import { errorResponseSchema } from "./error-handler.js";

const createAccountRequest = Type.Object({
  email: Type.String({ minLength: 1, format: "email" }),
  password: Type.String({ minLength: 1, format: "password", writeOnly: true }),
});
type CreateAccountRequest = Static<typeof createAccountRequest>;

const accountResponse = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  email: Type.String({ minLength: 1, format: "email" }),
  createdAt: Type.String({ format: "date-time" }),
});

export function registerAuthRoutes<Logger extends FastifyBaseLogger>(
  server: FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    Logger
  >,
  accountRegistration: Pick<AccountRegistrationService, "register">,
): void {
  server.post(
    "/api/v1/auth/accounts",
    {
      schema: {
        body: createAccountRequest,
        response: {
          201: accountResponse,
          400: errorResponseSchema,
          429: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await accountRegistration.register({
        ...(request.body as CreateAccountRequest),
        rateLimitKey: request.ip,
      });
      return reply.code(201).send(result);
    },
  );
}

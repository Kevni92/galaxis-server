// Feature: GAL-POP-START-001
// Fachliche Grundlage: docs/docs/05-population/bevoelkerung-und-arbeit.md
// Fachliche Grundlage: docs/docs/06-economy/wirtschaft-und-versorgung.md
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.md

import { Type, type Static } from "@sinclair/typebox";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify/types/utils.js";

import { ApplicationError } from "../../application/errors.js";
import type { PopulationService } from "../../application/population/service.js";
import type { SessionService } from "../../application/sessions/service.js";
import { authenticateSession } from "./auth-hook.js";
import { errorResponseSchema } from "./error-handler.js";
import { economySummaryResponse, populationSummaryResponse } from "./a1-schemas.js";

const empireScopeParams = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  empireId: Type.String({ minLength: 1 }),
});

export { economySummaryResponse, populationSummaryResponse };

type RouteServer<Logger extends FastifyBaseLogger> = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  Logger
>;

function accountId(request: { authIdentity: { accountId: string } | null }): string {
  if (request.authIdentity === null) {
    throw new ApplicationError("UNAUTHORIZED", "Keine gültige Session vorhanden.");
  }
  return request.authIdentity.accountId;
}

export function registerPopulationRoutes<Logger extends FastifyBaseLogger>(
  server: RouteServer<Logger>,
  populationService: Pick<PopulationService, "getPopulationSummary" | "getEconomySummary">,
  sessionService: Pick<SessionService, "authenticate">,
): void {
  const authentication = authenticateSession(sessionService);

  server.get(
    "/api/v1/campaigns/:campaignId/empires/:empireId/population",
    {
      preHandler: authentication,
      schema: {
        params: empireScopeParams,
        response: {
          200: populationSummaryResponse,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as Static<typeof empireScopeParams>;
      return populationService.getPopulationSummary(
        accountId(request),
        params.campaignId,
        params.empireId,
      );
    },
  );

  server.get(
    "/api/v1/campaigns/:campaignId/empires/:empireId/economy",
    {
      preHandler: authentication,
      schema: {
        params: empireScopeParams,
        response: {
          200: economySummaryResponse,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as Static<typeof empireScopeParams>;
      return populationService.getEconomySummary(
        accountId(request),
        params.campaignId,
        params.empireId,
      );
    },
  );
}

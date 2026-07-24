// Feature: GAL-API-A1-STATE-001
// Fachliche Grundlage: docs/contracts/rest-api/galaxis-rest-v1.md

import { Type, type Static } from "@sinclair/typebox";
import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify/types/utils.js";

import { ApplicationError } from "../../application/errors.js";
import type { StateQueryService } from "../../application/state/service.js";
import type { SessionService } from "../../application/sessions/service.js";
import { authenticateSession } from "./auth-hook.js";
import { errorResponseSchema } from "./error-handler.js";
import {
  campaignStateResponse,
  colonyOverviewResponse,
  galaxyOverviewResponse,
  systemDetailResponse,
} from "./a1-schemas.js";

const campaignParams = Type.Object({ campaignId: Type.String({ minLength: 1 }) });
const systemParams = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  systemId: Type.String({ minLength: 1 }),
});
const empireScopeParams = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  empireId: Type.String({ minLength: 1 }),
});

export {
  campaignStateResponse,
  colonyOverviewResponse,
  galaxyOverviewResponse,
  systemDetailResponse,
};

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

/** Schwacher ETag aus Ressourcenname und stateVersion; private, reichsspezifische Antwort. */
function etagFor(resource: string, stateVersion: number): string {
  return `W/"${resource}-${stateVersion}"`;
}

/** Beantwortet unveränderten sichtbaren Zustand mit 304; setzt ETag und private Cache-Header. */
function sendWithEtag(
  request: FastifyRequest,
  reply: FastifyReply,
  resource: string,
  stateVersion: number,
  body: unknown,
): unknown {
  const etag = etagFor(resource, stateVersion);
  reply.header("cache-control", "private, no-cache");
  reply.header("etag", etag);
  if (request.headers["if-none-match"] === etag) {
    return reply.code(304).send();
  }
  return reply.send(body);
}

export function registerStateRoutes<Logger extends FastifyBaseLogger>(
  server: RouteServer<Logger>,
  stateService: Pick<
    StateQueryService,
    "getCampaignState" | "getGalaxyOverview" | "getSystemDetail" | "getColonyOverview"
  >,
  sessionService: Pick<SessionService, "authenticate">,
): void {
  const authentication = authenticateSession(sessionService);
  const errorResponses = {
    401: errorResponseSchema,
    404: errorResponseSchema,
  };

  server.get(
    "/api/v1/campaigns/:campaignId/state",
    {
      preHandler: authentication,
      schema: {
        params: campaignParams,
        response: {
          200: campaignStateResponse,
          304: {},
          500: errorResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as Static<typeof campaignParams>;
      const state = await stateService.getCampaignState(accountId(request), params.campaignId);
      return sendWithEtag(request, reply, "state", state.stateVersion, state);
    },
  );

  server.get(
    "/api/v1/campaigns/:campaignId/galaxy",
    {
      preHandler: authentication,
      schema: {
        params: campaignParams,
        response: {
          200: galaxyOverviewResponse,
          304: {},
          500: errorResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as Static<typeof campaignParams>;
      const galaxy = await stateService.getGalaxyOverview(accountId(request), params.campaignId);
      return sendWithEtag(request, reply, "galaxy", galaxy.stateVersion, galaxy);
    },
  );

  server.get(
    "/api/v1/campaigns/:campaignId/systems/:systemId",
    {
      preHandler: authentication,
      schema: {
        params: systemParams,
        response: {
          200: systemDetailResponse,
          304: {},
          500: errorResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as Static<typeof systemParams>;
      const system = await stateService.getSystemDetail(
        accountId(request),
        params.campaignId,
        params.systemId,
      );
      return sendWithEtag(request, reply, `system-${params.systemId}`, system.stateVersion, system);
    },
  );

  server.get(
    "/api/v1/campaigns/:campaignId/empires/:empireId/colonies",
    {
      preHandler: authentication,
      schema: {
        params: empireScopeParams,
        response: {
          200: colonyOverviewResponse,
          304: {},
          500: errorResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as Static<typeof empireScopeParams>;
      const colonies = await stateService.getColonyOverview(
        accountId(request),
        params.campaignId,
        params.empireId,
      );
      return sendWithEtag(
        request,
        reply,
        `colonies-${params.empireId}`,
        colonies.stateVersion,
        colonies,
      );
    },
  );
}

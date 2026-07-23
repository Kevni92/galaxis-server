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

const linkMap = Type.Record(Type.String(), Type.String());

const campaignParams = Type.Object({ campaignId: Type.String({ minLength: 1 }) });
const systemParams = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  systemId: Type.String({ minLength: 1 }),
});
const empireScopeParams = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  empireId: Type.String({ minLength: 1 }),
});

export const campaignStateResponse = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  status: Type.Literal("running"),
  timeProfile: Type.String({ minLength: 1 }),
  campaignTimeMs: Type.Integer({ minimum: 0 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  balancingVersion: Type.String({ minLength: 1 }),
  balancingHash: Type.String({ minLength: 1 }),
  controlledEmpire: Type.Object({
    empireId: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    canControl: Type.Boolean(),
  }),
  links: linkMap,
});

export const galaxyOverviewResponse = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  startSystemId: Type.String({ minLength: 1 }),
  knownSystems: Type.Array(
    Type.Object({
      systemId: Type.String({ minLength: 1 }),
      regionId: Type.String({ minLength: 1 }),
      starCount: Type.Integer({ minimum: 0 }),
      planetCount: Type.Integer({ minimum: 0 }),
      links: linkMap,
    }),
  ),
  knownConnections: Type.Array(
    Type.Object({
      connectionId: Type.String({ minLength: 1 }),
      fromSystemId: Type.String({ minLength: 1 }),
      toSystemId: Type.String({ minLength: 1 }),
      distance: Type.Integer({ minimum: 1 }),
    }),
  ),
});

export const systemDetailResponse = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  systemId: Type.String({ minLength: 1 }),
  regionId: Type.String({ minLength: 1 }),
  stars: Type.Array(
    Type.Object({
      starId: Type.String({ minLength: 1 }),
      starClass: Type.String({ minLength: 1 }),
    }),
  ),
  planets: Type.Array(
    Type.Object({
      planetId: Type.String({ minLength: 1 }),
      category: Type.String({ minLength: 1 }),
      size: Type.String({ minLength: 1 }),
      homeworldEligible: Type.Boolean(),
    }),
  ),
});

export const colonyOverviewResponse = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
  empireId: Type.String({ minLength: 1 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  colonies: Type.Array(
    Type.Object({
      colonyId: Type.String({ minLength: 1 }),
      systemId: Type.String({ minLength: 1 }),
      planetId: Type.String({ minLength: 1 }),
      isHomeColony: Type.Boolean(),
      lifecycleState: Type.String({ minLength: 1 }),
      specialization: Type.String({ minLength: 1 }),
      planet: Type.Object({
        category: Type.String({ minLength: 1 }),
        size: Type.String({ minLength: 1 }),
      }),
      links: linkMap,
    }),
  ),
});

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
        response: { 200: campaignStateResponse, ...errorResponses },
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
        response: { 200: galaxyOverviewResponse, ...errorResponses },
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
        response: { 200: systemDetailResponse, ...errorResponses },
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
        response: { 200: colonyOverviewResponse, ...errorResponses },
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

// Feature: GAL-CAMPAIGN-CREATE-001
// Fachliche Grundlage: docs/docs/11-campaign/kampagnenstruktur.md
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.md

import { Type, type Static } from "@sinclair/typebox";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify/types/utils.js";

import type { CampaignService } from "../../application/campaigns/service.js";
import { ApplicationError } from "../../application/errors.js";
import type { SessionService } from "../../application/sessions/service.js";
import { authenticateSession } from "./auth-hook.js";
import { errorResponseSchema } from "./error-handler.js";

export const createCampaignRequest = Type.Object(
  {
    seed: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    timeProfile: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
type CreateCampaignRequest = Static<typeof createCampaignRequest>;

export const campaignResponse = Type.Object(
  {
    campaignId: Type.String({ minLength: 1 }),
    type: Type.Literal("singleplayer"),
    status: Type.Literal("running"),
    seed: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    timeProfile: Type.String({ minLength: 1 }),
    balancingVersion: Type.String({ minLength: 1 }),
    catalogVersion: Type.String({ minLength: 1 }),
    balancingHash: Type.String({ minLength: 1 }),
    stateVersion: Type.Integer({ minimum: 1 }),
    createdAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const campaignListResponse = Type.Object(
  {
    campaigns: Type.Array(campaignResponse),
  },
  { additionalProperties: false },
);

const campaignParams = Type.Object({
  campaignId: Type.String({ minLength: 1 }),
});

const idempotencyHeaders = Type.Object({
  "idempotency-key": Type.String({ minLength: 1 }),
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

export function registerCampaignRoutes<Logger extends FastifyBaseLogger>(
  server: RouteServer<Logger>,
  campaignService: Pick<CampaignService, "create" | "list" | "get">,
  sessionService: Pick<SessionService, "authenticate">,
): void {
  const authentication = authenticateSession(sessionService);

  server.post(
    "/api/v1/campaigns",
    {
      preHandler: authentication,
      schema: {
        headers: idempotencyHeaders,
        body: createCampaignRequest,
        response: {
          201: campaignResponse,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateCampaignRequest;
      const result = await campaignService.create({
        accountId: accountId(request),
        seed: body.seed,
        timeProfile: body.timeProfile,
        idempotencyKey: request.headers["idempotency-key"] as string,
      });
      return reply.code(201).send(result);
    },
  );

  server.get(
    "/api/v1/campaigns",
    {
      preHandler: authentication,
      schema: {
        response: { 200: campaignListResponse, 401: errorResponseSchema, 500: errorResponseSchema },
      },
    },
    async (request) => ({ campaigns: await campaignService.list(accountId(request)) }),
  );

  server.get(
    "/api/v1/campaigns/:campaignId",
    {
      preHandler: authentication,
      schema: {
        params: campaignParams,
        response: {
          200: campaignResponse,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as Static<typeof campaignParams>;
      return campaignService.get(accountId(request), params.campaignId);
    },
  );
}

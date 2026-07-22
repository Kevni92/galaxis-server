// Feature: GAL-API-CORE-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { Type } from "@sinclair/typebox";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify/types/utils.js";

import type { ReadinessProbe } from "../../application/health/readiness.js";
import { errorResponseSchema } from "./error-handler.js";

const liveResponse = Type.Object({
  status: Type.Literal("ok"),
  correlationId: Type.String(),
});
const readyResponse = Type.Object({
  status: Type.Literal("ready"),
  correlationId: Type.String(),
});
const notReadyResponse = Type.Object({
  status: Type.Literal("not_ready"),
  correlationId: Type.String(),
});

export function registerHealthRoutes<Logger extends FastifyBaseLogger>(
  server: FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    Logger
  >,
  readinessProbe: ReadinessProbe,
): void {
  server.get(
    "/health/live",
    {
      schema: {
        response: {
          200: liveResponse,
          400: errorResponseSchema,
          415: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request) => {
      request.log.info({ component: "health", correlationId: request.id }, "liveness check");
      return { status: "ok", correlationId: request.id };
    },
  );

  server.get(
    "/health/ready",
    {
      schema: {
        response: {
          200: readyResponse,
          400: errorResponseSchema,
          415: errorResponseSchema,
          500: errorResponseSchema,
          503: notReadyResponse,
        },
      },
    },
    async (request, reply) => {
      let result: Awaited<ReturnType<ReadinessProbe["check"]>>;
      try {
        result = await readinessProbe.check();
      } catch {
        request.log.warn(
          { component: "health", correlationId: request.id, reason: "probe_failed" },
          "readiness check failed",
        );
        return reply.code(503).send({ status: "not_ready", correlationId: request.id });
      }

      if (result.ready) {
        request.log.info({ component: "health", correlationId: request.id }, "readiness check");
        return { status: "ready", correlationId: request.id };
      }

      request.log.warn(
        { component: "health", correlationId: request.id },
        "readiness check failed",
      );
      return reply.code(503).send({ status: "not_ready", correlationId: request.id });
    },
  );
}

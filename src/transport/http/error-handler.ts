// Feature: GAL-API-CORE-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { Type } from "@sinclair/typebox";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { FastifyTypeProvider } from "fastify/types/type-provider.js";
import type {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
} from "fastify/types/utils.js";

import { DomainError } from "../../domain/errors.js";

const technicalErrorMessages = {
  invalidRequest: "Der Request ist ungültig.",
  routeNotFound: "Die angeforderte Route wurde nicht gefunden.",
  methodNotAllowed: "Die HTTP-Methode wird für diese Route nicht unterstützt.",
  unsupportedMediaType: "Der Content-Type wird nicht unterstützt.",
  requestTooLarge: "Der Request überschreitet die maximal erlaubte Größe.",
  internal: "Ein unerwarteter Serverfehler ist aufgetreten.",
} as const;

export const errorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    correlationId: Type.String({ minLength: 1 }),
    details: Type.Optional(
      Type.Array(
        Type.Object({
          field: Type.String({ minLength: 1 }),
          reason: Type.String({ minLength: 1 }),
        }),
      ),
    ),
    retryable: Type.Boolean(),
    currentStateVersion: Type.Optional(Type.Integer({ minimum: 0 })),
  }),
});

interface ErrorResponseOptions {
  readonly code: string;
  readonly message: string;
  readonly correlationId: string;
  readonly details?: readonly { field: string; reason: string }[];
  readonly retryable: boolean;
}

function errorResponse(options: ErrorResponseOptions) {
  return {
    error: {
      code: options.code,
      message: options.message,
      correlationId: options.correlationId,
      ...(options.details === undefined ? {} : { details: options.details }),
      retryable: options.retryable,
    },
  };
}

function requestPath(url: string): string {
  return url.split("?", 1)[0] ?? url;
}

function isUnsupportedContentType(
  method: string,
  contentType: string | string[] | undefined,
): boolean {
  if (!/(?:POST|PUT|PATCH|DELETE)/u.test(method) || typeof contentType !== "string") {
    return false;
  }
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) return true;

  const charset = /(?:^|;)\s*charset\s*=\s*([^;\s]+)/iu.exec(contentType)?.[1];
  return charset !== undefined && charset.toLowerCase() !== "utf-8";
}

function isFastifyError(error: unknown): error is {
  code?: unknown;
  validation?: unknown;
} {
  return typeof error === "object" && error !== null;
}

function statusForDomainError(error: DomainError): number {
  if (error.code === "ACCOUNT_REGISTRATION_REJECTED") return 400;
  if (error.code === "RATE_LIMITED") return 429;
  if (error.code === "AUTHENTICATION_FAILED") return 401;
  if (error.code === "SESSION_INVALID") return 401;
  if (error.code === "UNAUTHORIZED") return 401;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "RESOURCE_NOT_FOUND") return 404;
  if (error.code === "CONFLICT") return 409;
  return 422;
}

export class UnsupportedMediaTypeError extends Error {
  public readonly statusCode = 415;

  public constructor() {
    super(technicalErrorMessages.unsupportedMediaType);
    this.name = "UnsupportedMediaTypeError";
  }
}

export function registerErrorHandling<
  RawServer extends RawServerBase,
  RawRequest extends RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer>,
  Logger extends FastifyBaseLogger,
  TypeProvider extends FastifyTypeProvider,
>(server: FastifyInstance<RawServer, RawRequest, RawReply, Logger, TypeProvider>): void {
  const methodsByPath = new Map<string, Set<string>>();

  server.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const urls = Array.isArray(route.url) ? route.url : [route.url];

    for (const url of urls) {
      const methodsForPath = methodsByPath.get(url) ?? new Set<string>();
      for (const method of methods) methodsForPath.add(method.toUpperCase());
      methodsByPath.set(url, methodsForPath);
    }
  });

  server.addHook("onRequest", async (request) => {
    if (isUnsupportedContentType(request.method, request.headers["content-type"])) {
      throw new UnsupportedMediaTypeError();
    }
  });

  server.setNotFoundHandler((request, reply) => {
    const methods = methodsByPath.get(requestPath(request.url));
    const allowedMethods = methods === undefined ? undefined : [...methods].sort();

    if (allowedMethods !== undefined && !methods?.has(request.method)) {
      return reply
        .header("allow", allowedMethods.join(", "))
        .code(405)
        .send(
          errorResponse({
            code: "INVALID_REQUEST",
            message: technicalErrorMessages.methodNotAllowed,
            correlationId: request.id,
            retryable: false,
          }),
        );
    }

    return reply.code(404).send(
      errorResponse({
        code: "INVALID_REQUEST",
        message: technicalErrorMessages.routeNotFound,
        correlationId: request.id,
        retryable: false,
      }),
    );
  });

  server.setErrorHandler((error: unknown, request, reply) => {
    if (reply.sent) return;

    if (error instanceof DomainError) {
      const details = error.details;
      return reply.code(statusForDomainError(error)).send(
        errorResponse({
          code: error.code,
          message: error.message,
          correlationId: request.id,
          ...(details === undefined ? {} : { details }),
          retryable: error.retryable,
        }),
      );
    }

    if (error instanceof UnsupportedMediaTypeError) {
      return reply.code(error.statusCode).send(
        errorResponse({
          code: "INVALID_REQUEST",
          message: technicalErrorMessages.unsupportedMediaType,
          correlationId: request.id,
          retryable: false,
        }),
      );
    }

    if (isFastifyError(error)) {
      if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
        return reply.code(415).send(
          errorResponse({
            code: "INVALID_REQUEST",
            message: technicalErrorMessages.unsupportedMediaType,
            correlationId: request.id,
            retryable: false,
          }),
        );
      }

      if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
        return reply.code(413).send(
          errorResponse({
            code: "INVALID_REQUEST",
            message: technicalErrorMessages.requestTooLarge,
            correlationId: request.id,
            retryable: false,
          }),
        );
      }

      if (error.validation !== undefined || error.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
        return reply.code(400).send(
          errorResponse({
            code: "INVALID_REQUEST",
            message: technicalErrorMessages.invalidRequest,
            correlationId: request.id,
            retryable: false,
          }),
        );
      }
    }

    return reply.code(500).send(
      errorResponse({
        code: "INTERNAL_ERROR",
        message: technicalErrorMessages.internal,
        correlationId: request.id,
        retryable: true,
      }),
    );
  });
}

import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import { ApplicationError } from "../../src/application/errors.js";
import { createServer } from "../../src/app/composition-root/server.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";

const config = loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" });

function registerTestRoutes(server: ReturnType<typeof createServer>): void {
  server.post(
    "/api/v1/test/schema",
    {
      schema: {
        body: Type.Object({ name: Type.String({ minLength: 2 }) }),
        response: { 200: Type.Object({ accepted: Type.Literal(true) }) },
      },
    },
    async () => ({ accepted: true as const }),
  );

  server.get(
    "/api/v1/test/internal",
    { schema: { response: { 200: Type.Object({ ok: Type.Literal(true) }) } } },
    async () => {
      throw new Error("database password must not be exposed");
    },
  );

  server.get(
    "/api/v1/test/domain-error",
    { schema: { response: { 200: Type.Object({ ok: Type.Literal(true) }) } } },
    async () => {
      throw new ApplicationError("CONFLICT", "Die angeforderte Änderung steht im Konflikt.", {
        retryable: false,
        details: [{ field: "stateVersion", reason: "STALE" }],
      });
    },
  );
}

describe("REST core", () => {
  it.each([
    ["unknown route", { method: "GET", url: "/api/v1/does-not-exist" }, 404],
    ["wrong method", { method: "POST", url: "/health/live" }, 405],
  ] as const)("returns a safe response for %s", async (_name, request, statusCode) => {
    const server = createServer(config);

    try {
      const response = await server.inject(request);

      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toMatchObject({
        error: {
          code: "INVALID_REQUEST",
          correlationId: expect.any(String),
          retryable: false,
        },
      });
      if (statusCode === 405) expect(response.headers.allow).toBe("GET, HEAD");
    } finally {
      await server.close();
    }
  });

  it("rejects malformed JSON and unsupported media types", async () => {
    const server = createServer(config);
    registerTestRoutes(server);

    try {
      const invalidJson = await server.inject({
        method: "POST",
        url: "/api/v1/test/schema",
        headers: { "content-type": "application/json", "x-correlation-id": "cor_json" },
        payload: "{",
      });
      const unsupportedMediaType = await server.inject({
        method: "POST",
        url: "/api/v1/test/schema",
        headers: { "content-type": "text/plain", "x-correlation-id": "cor_media" },
        payload: "plain text",
      });
      const unsupportedCharset = await server.inject({
        method: "POST",
        url: "/api/v1/test/schema",
        headers: {
          "content-type": "application/json; charset=iso-8859-1",
          "x-correlation-id": "cor_charset",
        },
        payload: JSON.stringify({ name: "valid" }),
      });

      expect(invalidJson.statusCode).toBe(400);
      expect(unsupportedMediaType.statusCode).toBe(415);
      expect(unsupportedCharset.statusCode).toBe(415);
      expect(invalidJson.json().error.correlationId).toBe("cor_json");
      expect(unsupportedMediaType.json().error.code).toBe("INVALID_REQUEST");
      expect(unsupportedCharset.json().error.code).toBe("INVALID_REQUEST");
    } finally {
      await server.close();
    }
  });

  it("validates request and response schemas at runtime", async () => {
    const server = createServer(config);
    registerTestRoutes(server);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/test/schema",
        headers: { "content-type": "application/json" },
        payload: { name: "x" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("INVALID_REQUEST");
    } finally {
      await server.close();
    }
  });

  it("enforces the configured request size limit", async () => {
    const smallConfig = loadConfig({
      GALAXIS_PORT: "3000",
      GALAXIS_LOG_LEVEL: "silent",
      GALAXIS_MAX_BODY_BYTES: "64",
    });
    const server = createServer(smallConfig);
    registerTestRoutes(server);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/test/schema",
        headers: { "content-type": "application/json" },
        payload: { name: "x".repeat(100) },
      });

      expect(response.statusCode).toBe(413);
      expect(response.json().error.code).toBe("INVALID_REQUEST");
    } finally {
      await server.close();
    }
  });

  it("translates application errors and hides unexpected error details", async () => {
    const server = createServer(config);
    registerTestRoutes(server);

    try {
      const domainError = await server.inject({ method: "GET", url: "/api/v1/test/domain-error" });
      const internalError = await server.inject({ method: "GET", url: "/api/v1/test/internal" });

      expect(domainError.statusCode).toBe(409);
      expect(domainError.json()).toMatchObject({
        error: {
          code: "CONFLICT",
          details: [{ field: "stateVersion", reason: "STALE" }],
          retryable: false,
        },
      });
      expect(internalError.statusCode).toBe(500);
      expect(internalError.json()).toEqual({
        error: {
          code: "INTERNAL_ERROR",
          message: "Ein unerwarteter Serverfehler ist aufgetreten.",
          correlationId: expect.any(String),
          retryable: true,
        },
      });
      expect(internalError.body).not.toContain("database password");
    } finally {
      await server.close();
    }
  });
});

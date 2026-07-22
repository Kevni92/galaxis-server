// Feature: GAL-API-CONTRACT-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

import { createApplication } from "../../src/app/composition-root/application.js";
import { accountResponse, createAccountRequest } from "../../src/transport/http/auth-routes.js";
import {
  liveResponse,
  notReadyResponse,
  readyResponse,
} from "../../src/transport/http/health-routes.js";
import {
  sessionCreatedResponse,
  sessionCredentialsRequest,
  sessionResponse,
} from "../../src/transport/http/session-routes.js";
import { errorResponseSchema } from "../../src/transport/http/error-handler.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";
import { createPostgresDatabase } from "../../src/infrastructure/database/database.js";
import { runMigrations } from "../../src/infrastructure/database/migrations.js";
import { migrationDirectory } from "../fixtures/migrations.js";
import {
  loadOpenApiDocument,
  requestSchema,
  responseSchema,
  responseStatuses,
  typeBoxSchemaErrors,
  unresolvedReferences,
  valueSchemaErrors,
  type OpenApiDocument,
} from "./openapi.js";

describe("OpenAPI v1 contract", () => {
  let document: OpenApiDocument;
  let container: StartedTestContainer | undefined;
  let application: ReturnType<typeof createApplication> | undefined;

  beforeAll(async () => {
    document = await loadOpenApiDocument();

    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({
          POSTGRES_DB: "galaxis_contract_test",
          POSTGRES_USER: "galaxis",
          POSTGRES_PASSWORD: "galaxis",
        })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/u, 2))
        .withStartupTimeout(120000)
        .start();
    } catch (error) {
      console.warn(
        `Skipping PostgreSQL contract tests because Docker is unavailable: ${String(error)}`,
      );
    }

    if (container === undefined) return;

    const databaseUrl = `postgres://galaxis:galaxis@${container.getHost()}:${container.getMappedPort(5432)}/galaxis_contract_test`;
    const config = loadConfig({
      GALAXIS_PORT: "3000",
      GALAXIS_LOG_LEVEL: "silent",
      GALAXIS_DATABASE_URL: databaseUrl,
    });
    const database = createPostgresDatabase(config);
    try {
      await runMigrations(database.pool, migrationDirectory);
      application = createApplication(config, { database });
    } catch (error) {
      await database.close();
      throw error;
    }
  }, 180000);

  afterAll(async () => {
    await application?.shutdown("contract-tests");
    await container?.stop();
  });

  it("has the required OpenAPI structure and only resolvable references", () => {
    expect(document.openapi, "OpenAPI version").toBe("3.1.0");
    expect(document.info, "OpenAPI info object").toBeDefined();
    expect(document.paths, "OpenAPI paths object").toBeDefined();
    expect(Object.keys(document.paths), "OpenAPI paths").toEqual([
      "/health/live",
      "/health/ready",
      "/api/v1/auth/accounts",
      "/api/v1/auth/sessions",
      "/api/v1/auth/session",
      "/api/v1/auth/sessions/current",
    ]);
    expect(unresolvedReferences(document), "OpenAPI references").toEqual([]);
    expect(
      valueSchemaErrors(document, responseSchema(document, "post", "/api/v1/auth/accounts", 201), {
        accountId: "acc_contract_0001",
        email: "captain@example.test",
        createdAt: "2026-07-22T12:00:00Z",
        additiveField: "allowed-by-v1",
      }),
      "POST /api/v1/auth/accounts 201 additive response field",
    ).toEqual([]);

    for (const path of Object.keys(document.paths)) {
      const pathItem = document.paths[path];
      if (typeof pathItem !== "object" || pathItem === null || Array.isArray(pathItem)) continue;
      const pathItemRecord = pathItem as Record<string, unknown>;
      for (const method of ["get", "post", "delete"]) {
        const operation = pathItemRecord[method];
        if (typeof operation !== "object" || operation === null) continue;
        expect(operation, `${method.toUpperCase()} ${path} operationId`).toHaveProperty(
          "operationId",
        );
        expect(
          responseStatuses(document, method, path),
          `${method.toUpperCase()} ${path} responses`,
        ).not.toEqual([]);
      }
    }
  });

  it("keeps the TypeBox route schemas covered by the OpenAPI contract", () => {
    const mappings = [
      ["GET", "/health/live", "response", 200, liveResponse],
      ["GET", "/health/ready", "response", 200, readyResponse],
      ["GET", "/health/ready", "response", 503, notReadyResponse],
      ["POST", "/api/v1/auth/accounts", "request", undefined, createAccountRequest],
      ["POST", "/api/v1/auth/accounts", "response", 201, accountResponse],
      ["POST", "/api/v1/auth/sessions", "request", undefined, sessionCredentialsRequest],
      ["POST", "/api/v1/auth/sessions", "response", 201, sessionCreatedResponse],
      ["GET", "/api/v1/auth/session", "response", 200, sessionResponse],
    ] as const;

    for (const [method, path, kind, status, routeSchema] of mappings) {
      const schema =
        kind === "request"
          ? requestSchema(document, method.toLowerCase(), path)
          : responseSchema(document, method.toLowerCase(), path, status ?? 0);
      expect(schema, `${method} ${path} ${kind} ${status ?? ""} OpenAPI schema`).toBeDefined();
      const errors = typeBoxSchemaErrors(document, schema, routeSchema);
      expect(errors, `${method} ${path} ${kind} TypeBox compatibility`).toEqual([]);
    }

    const errorMappings = [
      ["POST", "/api/v1/auth/accounts", 400],
      ["POST", "/api/v1/auth/sessions", 400],
      ["POST", "/api/v1/auth/sessions", 401],
      ["GET", "/api/v1/auth/session", 401],
      ["DELETE", "/api/v1/auth/sessions/current", 401],
    ] as const;
    for (const [method, path, status] of errorMappings) {
      const schema = responseSchema(document, method.toLowerCase(), path, status);
      expect(schema, `${method} ${path} ${status} OpenAPI error schema`).toBeDefined();
      expect(
        typeBoxSchemaErrors(document, schema, errorResponseSchema),
        `${method} ${path} ${status} TypeBox error compatibility`,
      ).toEqual([]);
    }
  });

  it("rejects invalid request examples through the real Fastify adapter", async ({ skip }) => {
    if (application === undefined) return skip();
    const response = await application.server.inject({
      method: "POST",
      url: "/api/v1/auth/accounts",
      headers: { "content-type": "application/json" },
      payload: { email: "not-an-email", password: "secret" },
    });

    expect(response.statusCode, "POST /api/v1/auth/accounts invalid request status").toBe(400);
    const body: unknown = response.json();
    const errors = valueSchemaErrors(
      document,
      responseSchema(document, "post", "/api/v1/auth/accounts", 400),
      body,
    );
    expect(errors, "POST /api/v1/auth/accounts 400 response schema").toEqual([]);
  });

  it("checks registration, login, current session, logout, health, and error responses", async ({
    skip,
  }) => {
    if (application === undefined) return skip();
    const server = application.server;
    const email = "captain.contract@example.test";
    const password = "correct-horse-battery-staple";

    const checkResponse = async (
      method: string,
      path: string,
      response: { readonly statusCode: number; readonly body: string; json(): unknown },
      expectedStatus: number,
    ): Promise<unknown> => {
      expect(response.statusCode, `${method} ${path} status`).toBe(expectedStatus);
      const schema = responseSchema(document, method.toLowerCase(), path, expectedStatus);
      if (schema === undefined) {
        expect(response.body, `${method} ${path} ${expectedStatus} body`).toBe("");
        return undefined;
      }
      const body: unknown = response.json();
      expect(
        valueSchemaErrors(document, schema, body),
        `${method} ${path} ${expectedStatus} response schema`,
      ).toEqual([]);
      return body;
    };

    await checkResponse(
      "GET",
      "/health/live",
      await server.inject({ method: "GET", url: "/health/live" }),
      200,
    );
    await checkResponse(
      "GET",
      "/health/ready",
      await server.inject({ method: "GET", url: "/health/ready" }),
      200,
    );

    const registration = await server.inject({
      method: "POST",
      url: "/api/v1/auth/accounts",
      headers: { "content-type": "application/json" },
      payload: { email, password },
    });
    await checkResponse("POST", "/api/v1/auth/accounts", registration, 201);

    const invalidLogin = await server.inject({
      method: "POST",
      url: "/api/v1/auth/sessions",
      headers: { "content-type": "application/json" },
      payload: { email, password: "wrong-password" },
    });
    await checkResponse("POST", "/api/v1/auth/sessions", invalidLogin, 401);

    const login = await server.inject({
      method: "POST",
      url: "/api/v1/auth/sessions",
      headers: { "content-type": "application/json" },
      payload: { email, password },
    });
    const session = (await checkResponse("POST", "/api/v1/auth/sessions", login, 201)) as {
      readonly token: string;
    };

    const current = await server.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { authorization: `Bearer ${session.token}` },
    });
    await checkResponse("GET", "/api/v1/auth/session", current, 200);

    const invalidSession = await server.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { authorization: "Bearer invalid-contract-token" },
    });
    await checkResponse("GET", "/api/v1/auth/session", invalidSession, 401);

    const logout = await server.inject({
      method: "DELETE",
      url: "/api/v1/auth/sessions/current",
      headers: { authorization: `Bearer ${session.token}` },
    });
    await checkResponse("DELETE", "/api/v1/auth/sessions/current", logout, 204);

    const afterLogout = await server.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { authorization: `Bearer ${session.token}` },
    });
    await checkResponse("GET", "/api/v1/auth/session", afterLogout, 401);
  });
});

// Feature: GAL-API-CONTRACT-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { fileURLToPath } from "node:url";

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
import {
  campaignListResponse,
  campaignResponse,
  createCampaignRequest,
} from "../../src/transport/http/campaign-routes.js";
import {
  campaignStateResponse,
  colonyOverviewResponse,
  galaxyOverviewResponse,
  systemDetailResponse,
} from "../../src/transport/http/state-routes.js";
import {
  economySummaryResponse,
  populationSummaryResponse,
} from "../../src/transport/http/population-routes.js";
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
  openApiExampleErrors,
  openApiStructureErrors,
  type OpenApiDocument,
} from "./openapi.js";

describe("OpenAPI v1 contract", () => {
  let document: OpenApiDocument;
  let a1Document: OpenApiDocument;
  let container: StartedTestContainer | undefined;
  let application: ReturnType<typeof createApplication> | undefined;

  beforeAll(async () => {
    document = await loadOpenApiDocument();
    a1Document = await loadOpenApiDocument(
      fileURLToPath(
        new URL("../../docs/contracts/rest-api/galaxis-rest-v1-a1.yaml", import.meta.url),
      ),
    );

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
    for (const [label, contract] of [
      ["docs/contracts/rest-api/galaxis-rest-v1.yaml", document],
      ["docs/contracts/rest-api/galaxis-rest-v1-a1.yaml", a1Document],
    ] as const) {
      expect(openApiStructureErrors(contract, label), `${label} structure`).toEqual([]);
      expect(openApiExampleErrors(contract, label), `${label} examples`).toEqual([]);
      expect(contract.openapi, `${label} OpenAPI version`).toBe("3.1.0");
      expect(contract.info, `${label} OpenAPI info object`).toBeDefined();
      expect(contract.paths, `${label} OpenAPI paths object`).toBeDefined();
      expect(unresolvedReferences(contract), `${label} OpenAPI references`).toEqual([]);
    }
    expect(Object.keys(document.paths), "OpenAPI paths").toEqual([
      "/health/live",
      "/health/ready",
      "/api/v1/auth/accounts",
      "/api/v1/auth/sessions",
      "/api/v1/auth/session",
      "/api/v1/auth/sessions/current",
    ]);
    expect(Object.keys(a1Document.paths), "A1 OpenAPI paths").toEqual([
      "/api/v1/campaigns",
      "/api/v1/campaigns/{campaignId}",
      "/api/v1/campaigns/{campaignId}/state",
      "/api/v1/campaigns/{campaignId}/galaxy",
      "/api/v1/campaigns/{campaignId}/systems/{systemId}",
      "/api/v1/campaigns/{campaignId}/empires/{empireId}/colonies",
      "/api/v1/campaigns/{campaignId}/empires/{empireId}/population",
      "/api/v1/campaigns/{campaignId}/empires/{empireId}/economy",
    ]);

    const duplicateOperationId = structuredClone(document) as OpenApiDocument;
    const readyPath = duplicateOperationId.paths["/health/ready"] as Record<string, unknown>;
    readyPath.get = { ...(readyPath.get as Record<string, unknown>), operationId: "getHealthLive" };
    expect(openApiStructureErrors(duplicateOperationId, "synthetic-a0.yaml")).toEqual(
      expect.arrayContaining([expect.stringContaining("duplicate operationId getHealthLive")]),
    );

    const incompletePathParameter = structuredClone(a1Document) as OpenApiDocument;
    const statePath = incompletePathParameter.paths[
      "/api/v1/campaigns/{campaignId}/state"
    ] as Record<string, unknown>;
    statePath.parameters = [];
    expect(openApiStructureErrors(incompletePathParameter, "synthetic-a1.yaml")).toEqual(
      expect.arrayContaining([expect.stringContaining("incomplete path parameter {campaignId}")]),
    );
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

    const a1Mappings = [
      ["POST", "/api/v1/campaigns", "request", undefined, createCampaignRequest],
      ["GET", "/api/v1/campaigns", "response", 200, campaignListResponse],
      ["POST", "/api/v1/campaigns", "response", 201, campaignResponse],
      ["GET", "/api/v1/campaigns/{campaignId}", "response", 200, campaignResponse],
      ["GET", "/api/v1/campaigns/{campaignId}/state", "response", 200, campaignStateResponse],
      ["GET", "/api/v1/campaigns/{campaignId}/galaxy", "response", 200, galaxyOverviewResponse],
      [
        "GET",
        "/api/v1/campaigns/{campaignId}/systems/{systemId}",
        "response",
        200,
        systemDetailResponse,
      ],
      [
        "GET",
        "/api/v1/campaigns/{campaignId}/empires/{empireId}/colonies",
        "response",
        200,
        colonyOverviewResponse,
      ],
      [
        "GET",
        "/api/v1/campaigns/{campaignId}/empires/{empireId}/population",
        "response",
        200,
        populationSummaryResponse,
      ],
      [
        "GET",
        "/api/v1/campaigns/{campaignId}/empires/{empireId}/economy",
        "response",
        200,
        economySummaryResponse,
      ],
    ] as const;

    for (const [method, path, kind, status, routeSchema] of a1Mappings) {
      const schema =
        kind === "request"
          ? requestSchema(a1Document, method.toLowerCase(), path)
          : responseSchema(a1Document, method.toLowerCase(), path, status ?? 0);
      expect(schema, `A1 ${method} ${path} ${kind} ${status ?? ""} schema`).toBeDefined();
      expect(
        typeBoxSchemaErrors(a1Document, schema, routeSchema),
        `A1 ${method} ${path} ${kind} TypeBox compatibility`,
      ).toEqual([]);
    }

    for (const [method, path, status] of [
      ["GET", "/api/v1/campaigns", 401],
      ["POST", "/api/v1/campaigns", 400],
      ["POST", "/api/v1/campaigns", 401],
      ["POST", "/api/v1/campaigns", 409],
      ["GET", "/api/v1/campaigns/{campaignId}", 404],
      ["GET", "/api/v1/campaigns/{campaignId}/state", 404],
      ["GET", "/api/v1/campaigns/{campaignId}/galaxy", 404],
      ["GET", "/api/v1/campaigns/{campaignId}/systems/{systemId}", 404],
      ["GET", "/api/v1/campaigns/{campaignId}/empires/{empireId}/colonies", 404],
      ["GET", "/api/v1/campaigns/{campaignId}/empires/{empireId}/population", 404],
      ["GET", "/api/v1/campaigns/{campaignId}/empires/{empireId}/economy", 404],
    ] as const) {
      const schema = responseSchema(a1Document, method.toLowerCase(), path, status);
      expect(schema, `A1 ${method} ${path} ${status} error schema`).toBeDefined();
      expect(
        typeBoxSchemaErrors(a1Document, schema, errorResponseSchema),
        `A1 ${method} ${path} ${status} error compatibility`,
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

  it("checks all A1 routes, idempotency, knowledge boundaries, errors, and caching", async ({
    skip,
  }) => {
    if (application === undefined) return skip();
    const server = application.server;
    const checkResponse = async (
      method: string,
      path: string,
      response: { readonly statusCode: number; readonly body: string; json(): unknown },
      expectedStatus: number,
    ): Promise<unknown> => {
      expect(response.statusCode, `${method} ${path} status`).toBe(expectedStatus);
      const schema = responseSchema(a1Document, method.toLowerCase(), path, expectedStatus);
      if (schema === undefined) {
        expect(response.body, `${method} ${path} ${expectedStatus} body`).toBe("");
        return undefined;
      }
      const body: unknown = response.json();
      expect(
        valueSchemaErrors(a1Document, schema, body),
        `${method} ${path} ${expectedStatus} response schema`,
      ).toEqual([]);
      return body;
    };

    const email = "a1.contract@example.test";
    const password = "correct-horse-battery-staple";
    const registration = await server.inject({
      method: "POST",
      url: "/api/v1/auth/accounts",
      headers: { "content-type": "application/json" },
      payload: { email, password },
    });
    expect(registration.statusCode).toBe(201);
    expect(
      valueSchemaErrors(
        document,
        responseSchema(document, "post", "/api/v1/auth/accounts", 201),
        registration.json(),
      ),
    ).toEqual([]);
    const login = await server.inject({
      method: "POST",
      url: "/api/v1/auth/sessions",
      headers: { "content-type": "application/json" },
      payload: { email, password },
    });
    expect(login.statusCode).toBe(201);
    const token = (login.json() as { token: string }).token;
    const auth = { authorization: `Bearer ${token}` };

    await checkResponse(
      "GET",
      "/api/v1/campaigns",
      await server.inject({ method: "GET", url: "/api/v1/campaigns" }),
      401,
    );
    await checkResponse(
      "GET",
      "/api/v1/campaigns",
      await server.inject({
        method: "GET",
        url: "/api/v1/campaigns",
        headers: { authorization: "Bearer invalid" },
      }),
      401,
    );
    await checkResponse(
      "POST",
      "/api/v1/campaigns",
      await server.inject({
        method: "POST",
        url: "/api/v1/campaigns",
        headers: { ...auth, "content-type": "application/json" },
        payload: { seed: 42, timeProfile: "standard" },
      }),
      400,
    );
    await checkResponse(
      "POST",
      "/api/v1/campaigns",
      await server.inject({
        method: "POST",
        url: "/api/v1/campaigns",
        headers: {
          ...auth,
          "content-type": "application/json",
          "idempotency-key": "a1-contract-invalid-body",
        },
        payload: { seed: "not-a-number", timeProfile: "standard" },
      }),
      400,
    );

    const idempotencyKey = "a1-contract-idempotency-1";
    const createHeaders = {
      ...auth,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    };
    const created = await server.inject({
      method: "POST",
      url: "/api/v1/campaigns",
      headers: createHeaders,
      payload: { seed: 42, timeProfile: "standard" },
    });
    const createdBody = await checkResponse("POST", "/api/v1/campaigns", created, 201);
    const campaignId = (createdBody as { campaignId: string }).campaignId;
    const repeated = await server.inject({
      method: "POST",
      url: "/api/v1/campaigns",
      headers: createHeaders,
      payload: { seed: 42, timeProfile: "standard" },
    });
    const repeatedBody = await checkResponse("POST", "/api/v1/campaigns", repeated, 201);
    expect(repeatedBody).toEqual(createdBody);
    await checkResponse(
      "POST",
      "/api/v1/campaigns",
      await server.inject({
        method: "POST",
        url: "/api/v1/campaigns",
        headers: createHeaders,
        payload: { seed: 43, timeProfile: "standard" },
      }),
      409,
    );

    const campaignBase = `/api/v1/campaigns/${campaignId}`;
    await checkResponse(
      "GET",
      "/api/v1/campaigns",
      await server.inject({ method: "GET", url: "/api/v1/campaigns", headers: auth }),
      200,
    );
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}",
      await server.inject({ method: "GET", url: campaignBase, headers: auth }),
      200,
    );
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}",
      await server.inject({ method: "GET", url: "/api/v1/campaigns/cmp_unknown", headers: auth }),
      404,
    );

    const foreignEmail = "a1.foreign@example.test";
    await server.inject({
      method: "POST",
      url: "/api/v1/auth/accounts",
      headers: { "content-type": "application/json" },
      payload: { email: foreignEmail, password },
    });
    const foreignLogin = await server.inject({
      method: "POST",
      url: "/api/v1/auth/sessions",
      headers: { "content-type": "application/json" },
      payload: { email: foreignEmail, password },
    });
    const foreignToken = (foreignLogin.json() as { token: string }).token;
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}",
      await server.inject({
        method: "GET",
        url: campaignBase,
        headers: { authorization: `Bearer ${foreignToken}` },
      }),
      404,
    );

    const statePath = `${campaignBase}/state`;
    const state = await server.inject({ method: "GET", url: statePath, headers: auth });
    const stateBody = await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}/state",
      state,
      200,
    );
    expect(state.headers.etag).toMatch(/^W\/"state-[1-9][0-9]*"$/u);
    expect(state.headers["cache-control"]).toBe("private, no-cache");
    const notModified = await server.inject({
      method: "GET",
      url: statePath,
      headers: { ...auth, "if-none-match": state.headers.etag },
    });
    await checkResponse("GET", "/api/v1/campaigns/{campaignId}/state", notModified, 304);
    expect(notModified.headers.etag).toBe(state.headers.etag);
    expect(notModified.headers["cache-control"]).toBe("private, no-cache");
    expect(stateBody).toHaveProperty("generatedAt");

    const galaxy = await server.inject({
      method: "GET",
      url: `${campaignBase}/galaxy`,
      headers: auth,
    });
    const galaxyBody = (await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}/galaxy",
      galaxy,
      200,
    )) as { startSystemId: string; knownSystems: readonly { systemId: string }[] };
    expect(galaxyBody.knownSystems).toHaveLength(1);
    const systemId = galaxyBody.startSystemId;
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}/systems/{systemId}",
      await server.inject({
        method: "GET",
        url: `${campaignBase}/systems/${systemId}`,
        headers: auth,
      }),
      200,
    );
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}/systems/{systemId}",
      await server.inject({
        method: "GET",
        url: `${campaignBase}/systems/sys_unknown`,
        headers: auth,
      }),
      404,
    );

    const stateData = stateBody as { controlledEmpire: { empireId: string } };
    const empireId = stateData.controlledEmpire.empireId;
    const empireBase = `${campaignBase}/empires/${empireId}`;
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}/empires/{empireId}/colonies",
      await server.inject({ method: "GET", url: `${empireBase}/colonies`, headers: auth }),
      200,
    );
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}/empires/{empireId}/population",
      await server.inject({ method: "GET", url: `${empireBase}/population`, headers: auth }),
      200,
    );
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}/empires/{empireId}/economy",
      await server.inject({ method: "GET", url: `${empireBase}/economy`, headers: auth }),
      200,
    );
    await checkResponse(
      "GET",
      "/api/v1/campaigns/{campaignId}/empires/{empireId}/colonies",
      await server.inject({
        method: "GET",
        url: `${campaignBase}/empires/emp_unknown/colonies`,
        headers: auth,
      }),
      404,
    );
  }, 180000);
});

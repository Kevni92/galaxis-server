// Feature: GAL-SCENARIO-A1-001
// Fachliche Grundlage: docs/balancing/scenarios/s01-startreich.md

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

import { createApplication } from "../../src/app/composition-root/application.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";
import { createPostgresDatabase } from "../../src/infrastructure/database/database.js";
import { runMigrations } from "../../src/infrastructure/database/migrations.js";
import { migrationDirectory } from "../fixtures/migrations.js";
import { runA1Scenario, type HttpInvoke } from "../../src/scenario/a1-demo.js";

describe("A1 reference scenario", () => {
  let container: StartedTestContainer | undefined;
  let application: ReturnType<typeof createApplication> | undefined;

  beforeAll(async () => {
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({
          POSTGRES_DB: "galaxis_scenario_test",
          POSTGRES_USER: "galaxis",
          POSTGRES_PASSWORD: "galaxis",
        })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/u, 2))
        .withStartupTimeout(120000)
        .start();
    } catch (error) {
      console.warn(`Skipping A1 scenario test because Docker is unavailable: ${String(error)}`);
      return;
    }

    const databaseUrl = `postgres://galaxis:galaxis@${container.getHost()}:${container.getMappedPort(5432)}/galaxis_scenario_test`;
    const config = loadConfig({
      GALAXIS_PORT: "3000",
      GALAXIS_LOG_LEVEL: "silent",
      GALAXIS_DATABASE_URL: databaseUrl,
    });
    const database = createPostgresDatabase(config);
    try {
      await runMigrations(database.pool, migrationDirectory);
      application = createApplication(config, { database });
      await application.start();
    } catch (error) {
      await database.close();
      throw error;
    }
  }, 180000);

  afterAll(async () => {
    await application?.shutdown("scenario-tests");
    await container?.stop();
  });

  function invoker(app: ReturnType<typeof createApplication>): HttpInvoke {
    return async ({ method, path, body, token, headers }) => {
      const mergedHeaders: Record<string, string> = { ...headers };
      if (token !== undefined) mergedHeaders.authorization = `Bearer ${token}`;
      const response = await app.server.inject({
        method: method as "GET" | "POST" | "DELETE",
        url: path,
        ...(Object.keys(mergedHeaders).length === 0 ? {} : { headers: mergedHeaders }),
        ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
      });
      return {
        status: response.statusCode,
        json: response.body.length > 0 ? (response.json() as unknown) : null,
      };
    };
  }

  it("runs the full A1 demo and reproduces the same fachlicher hash for the same seed", async ({
    skip,
  }) => {
    if (application === undefined) return skip();
    const invoke = invoker(application);

    const first = await runA1Scenario(invoke, {
      seed: 42,
      email: `scenario-a-${randomUUID()}@example.test`,
      password: "correct-horse-battery-staple",
      idempotencyKey: randomUUID(),
    });
    const second = await runA1Scenario(invoke, {
      seed: 42,
      email: `scenario-b-${randomUUID()}@example.test`,
      password: "correct-horse-battery-staple",
      idempotencyKey: randomUUID(),
    });

    // Gleicher Seed liefert denselben fachlichen Hash und dieselbe Startversion.
    expect(first.digest).toBe(second.digest);
    expect(first.stateVersion).toBe(1);
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("produces a different fachlicher hash for a different seed", async ({ skip }) => {
    if (application === undefined) return skip();
    const invoke = invoker(application);

    const seed42 = await runA1Scenario(invoke, {
      seed: 42,
      email: `scenario-c-${randomUUID()}@example.test`,
      password: "correct-horse-battery-staple",
      idempotencyKey: randomUUID(),
    });
    const seed99 = await runA1Scenario(invoke, {
      seed: 99,
      email: `scenario-d-${randomUUID()}@example.test`,
      password: "correct-horse-battery-staple",
      idempotencyKey: randomUUID(),
    });

    expect(seed42.digest).not.toBe(seed99.digest);
  });

  it("does not leak unknown galaxy systems in the visible state", async ({ skip }) => {
    if (application === undefined) return skip();
    const invoke = invoker(application);

    const result = await runA1Scenario(invoke, {
      seed: 7,
      email: `scenario-e-${randomUUID()}@example.test`,
      password: "correct-horse-battery-staple",
      idempotencyKey: randomUUID(),
    });

    const state = result.normalizedState as {
      galaxy: { startSystemId: string; knownSystems: readonly { systemId: string }[] };
    };
    // Nur das Heimatsystem ist bekannt; keine weiteren Systeme werden offengelegt.
    expect(state.galaxy.knownSystems).toHaveLength(1);
    expect(state.galaxy.knownSystems[0]?.systemId).toBe(state.galaxy.startSystemId);
  });

  it("reports a reproducible seed and step on failure", async ({ skip }) => {
    if (application === undefined) return skip();
    const invoke = invoker(application);

    // Ungültige Anmeldedaten lassen den Login-Schritt kontrolliert scheitern.
    const failing: HttpInvoke = async (request) => {
      if (request.path === "/api/v1/auth/sessions") {
        return { status: 401, json: { error: { code: "AUTHENTICATION_FAILED" } } };
      }
      return invoke(request);
    };

    await expect(
      runA1Scenario(failing, {
        seed: 123,
        email: `scenario-f-${randomUUID()}@example.test`,
        password: "correct-horse-battery-staple",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ step: "login", seed: 123 });
  });
});

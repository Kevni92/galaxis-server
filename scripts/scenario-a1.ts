// Feature: GAL-SCENARIO-A1-001
// Fachliche Grundlage: docs/balancing/scenarios/s01-startreich.md

import { randomUUID } from "node:crypto";

import { createApplication } from "../src/app/composition-root/application.js";
import { loadConfig } from "../src/infrastructure/config/config.js";
import { A1ScenarioError, runA1Scenario, type HttpInvoke } from "../src/scenario/a1-demo.js";

function environmentWithDefaults(): Record<string, string | undefined> {
  return {
    ...process.env,
    GALAXIS_HOST: process.env.GALAXIS_HOST ?? "127.0.0.1",
    GALAXIS_PORT: process.env.GALAXIS_PORT ?? "3000",
    GALAXIS_LOG_LEVEL: process.env.GALAXIS_LOG_LEVEL ?? "silent",
    GALAXIS_DATABASE_URL:
      process.env.GALAXIS_DATABASE_URL ?? "postgres://galaxis:galaxis@127.0.0.1:5432/galaxis",
  };
}

function seedFromArgs(): number {
  const raw = process.argv[2] ?? "42";
  const seed = Number(raw);
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error(`scenario seed must be a non-negative integer, received '${raw}'`);
  }
  return seed;
}

async function run(): Promise<void> {
  const config = loadConfig(environmentWithDefaults());
  if (config.databaseUrl === undefined) {
    throw new Error("A1 scenario requires GALAXIS_DATABASE_URL and a migrated PostgreSQL database");
  }
  const seed = seedFromArgs();
  const application = createApplication(config);
  const invoke: HttpInvoke = async ({ method, path, body, token, headers }) => {
    const mergedHeaders: Record<string, string> = { ...headers };
    if (token !== undefined) mergedHeaders.authorization = `Bearer ${token}`;
    const response = await application.server.inject({
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

  let started = false;
  try {
    await application.start();
    started = true;
    const credentials = {
      email: `scenario-${randomUUID()}@example.test`,
      password: "correct-horse-battery-staple",
      idempotencyKey: randomUUID(),
    };

    const first = await runA1Scenario(invoke, { seed, ...credentials });
    // Reload: derselbe Seed und dieselbe Kampagne müssen denselben fachlichen Hash liefern.
    const reload = await runA1Scenario(invoke, {
      seed,
      email: `scenario-${randomUUID()}@example.test`,
      password: "correct-horse-battery-staple",
      idempotencyKey: randomUUID(),
    });

    if (first.digest !== reload.digest) {
      throw new Error(
        `A1 scenario is not reproducible for seed ${seed}: ${first.digest} != ${reload.digest}`,
      );
    }

    console.log(
      `A1 scenario passed for seed ${seed}: fachlicher Hash ${first.digest} (stateVersion ${first.stateVersion})`,
    );
  } finally {
    if (started) await application.shutdown("a1-scenario");
  }
}

try {
  await run();
} catch (error) {
  if (error instanceof A1ScenarioError) {
    console.error(
      `A1 scenario failed at step '${error.step}' (seed ${error.seed}): ${error.message}`,
    );
  } else {
    console.error(`A1 scenario failed: ${String(error)}`);
  }
  process.exitCode = 1;
}

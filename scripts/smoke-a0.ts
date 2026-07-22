// Feature: GAL-QUALITY-CI-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { randomUUID } from "node:crypto";

import { createApplication } from "../src/app/composition-root/application.js";
import { loadConfig } from "../src/infrastructure/config/config.js";

interface SmokeResponse {
  readonly status: number;
  readonly body: unknown;
  readonly text: string;
}

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

async function request(
  baseUrl: string,
  method: string,
  path: string,
  payload?: unknown,
  authorization?: string,
): Promise<SmokeResponse> {
  const headers: Record<string, string> = {};
  if (payload !== undefined) headers["content-type"] = "application/json";
  if (authorization !== undefined) headers.authorization = authorization;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const text = await response.text();
  let body: unknown = undefined;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  return { status: response.status, body, text };
}

function expectStatus(label: string, response: SmokeResponse, expected: number): void {
  if (response.status !== expected) {
    throw new Error(
      `${label}: expected HTTP ${expected}, received ${response.status}: ${response.text}`,
    );
  }
}

function tokenFrom(body: unknown): string {
  if (typeof body !== "object" || body === null || !("token" in body)) {
    throw new Error("POST /api/v1/auth/sessions: response did not contain a session token");
  }
  const token = body.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("POST /api/v1/auth/sessions: response token was empty");
  }
  return token;
}

async function run(): Promise<void> {
  const config = loadConfig(environmentWithDefaults());
  if (config.databaseUrl === undefined) {
    throw new Error("A0 smoke requires GALAXIS_DATABASE_URL and a migrated PostgreSQL database");
  }

  const application = createApplication(config);
  let started = false;
  try {
    await application.start();
    started = true;
    const baseUrl = `http://${config.host}:${config.port}`;
    const email = `smoke-${randomUUID()}@example.test`;
    const password = "correct-horse-battery-staple";

    expectStatus("GET /health/live", await request(baseUrl, "GET", "/health/live"), 200);
    expectStatus("GET /health/ready", await request(baseUrl, "GET", "/health/ready"), 200);
    expectStatus(
      "POST /api/v1/auth/accounts",
      await request(baseUrl, "POST", "/api/v1/auth/accounts", { email, password }),
      201,
    );

    const login = await request(baseUrl, "POST", "/api/v1/auth/sessions", {
      email,
      password,
    });
    expectStatus("POST /api/v1/auth/sessions", login, 201);
    const token = tokenFrom(login.body);

    expectStatus(
      "GET /api/v1/auth/session",
      await request(baseUrl, "GET", "/api/v1/auth/session", undefined, `Bearer ${token}`),
      200,
    );
    expectStatus(
      "DELETE /api/v1/auth/sessions/current",
      await request(
        baseUrl,
        "DELETE",
        "/api/v1/auth/sessions/current",
        undefined,
        `Bearer ${token}`,
      ),
      204,
    );
    expectStatus(
      "GET /api/v1/auth/session after logout",
      await request(baseUrl, "GET", "/api/v1/auth/session", undefined, `Bearer ${token}`),
      401,
    );

    console.log("A0 smoke passed: health, registration, login, session, logout");
  } finally {
    if (started) await application.shutdown("a0-smoke");
  }
}

try {
  await run();
} catch (error) {
  console.error(`A0 smoke failed: ${String(error)}`);
  process.exitCode = 1;
}

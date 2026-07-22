import { describe, expect, it } from "vitest";

import { AccountRegistrationService } from "../../src/application/accounts/registration.js";
import { createServer } from "../../src/app/composition-root/server.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";
import { FakeWallClock } from "../../src/infrastructure/runtime/clocks.js";
import { FakeIdGenerator } from "../../src/infrastructure/runtime/ids.js";

const config = loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" });

describe("account registration HTTP contract", () => {
  it("creates an account and returns only the public representation", async () => {
    const server = createServer(config, {
      accountRegistration: new AccountRegistrationService({
        repository: { create: async () => true },
        passwordHasher: {
          hash: async () => "argon2id$test-hash",
          verify: async () => true,
        },
        idGenerator: new FakeIdGenerator(),
        wallClock: new FakeWallClock(Date.UTC(2026, 0, 2)),
      }),
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/accounts",
        headers: { "content-type": "application/json", "x-correlation-id": "cor_account" },
        payload: { email: "USER@example.com", password: "secret" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        accountId: "acc_fake_0001",
        email: "user@example.com",
        createdAt: "2026-01-02T00:00:00.000Z",
      });
      expect(response.body).not.toContain("secret");
    } finally {
      await server.close();
    }
  });

  it("returns a contract-safe rejection for duplicate registration", async () => {
    const server = createServer(config, {
      accountRegistration: new AccountRegistrationService({
        repository: { create: async () => false },
        passwordHasher: {
          hash: async () => "argon2id$test-hash",
          verify: async () => true,
        },
        idGenerator: new FakeIdGenerator(),
        wallClock: new FakeWallClock(),
      }),
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/accounts",
        headers: { "content-type": "application/json" },
        payload: { email: "user@example.com", password: "secret" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "ACCOUNT_REGISTRATION_REJECTED",
          message: "Die Registrierung konnte nicht abgeschlossen werden.",
          retryable: false,
        },
      });
      expect(response.body).not.toContain("secret");
    } finally {
      await server.close();
    }
  });

  it("maps an injected rate limit decision to 429", async () => {
    const server = createServer(config, {
      accountRegistration: new AccountRegistrationService({
        repository: { create: async () => true },
        passwordHasher: {
          hash: async () => "argon2id$test-hash",
          verify: async () => true,
        },
        idGenerator: new FakeIdGenerator(),
        wallClock: new FakeWallClock(),
        rateLimiter: { allow: async () => false },
      }),
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/accounts",
        headers: { "content-type": "application/json" },
        payload: { email: "user@example.com", password: "secret" },
      });

      expect(response.statusCode).toBe(429);
      expect(response.json()).toMatchObject({
        error: { code: "RATE_LIMITED", retryable: true },
      });
    } finally {
      await server.close();
    }
  });
});

import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import type {
  AccountCredentialReader,
  PasswordHasher,
} from "../../src/application/accounts/ports.js";
import { createServer } from "../../src/app/composition-root/server.js";
import { SessionService } from "../../src/application/sessions/service.js";
import type {
  SessionRepository,
  SessionTokenGenerator,
} from "../../src/application/sessions/ports.js";
import { authenticateSession } from "../../src/transport/http/auth-hook.js";
import type { Account } from "../../src/domain/accounts/account.js";
import type { Session } from "../../src/domain/sessions/session.js";
import { FakeWallClock } from "../../src/infrastructure/runtime/clocks.js";
import { FakeIdGenerator } from "../../src/infrastructure/runtime/ids.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";

const config = loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" });
const account: Account = {
  id: "acc_http_0001",
  email: "captain@example.test",
  passwordHash: "stored-password-hash",
  createdAt: 0,
};

function createSessionService(): SessionService {
  let storedSession: Session | undefined;
  const accountReader: AccountCredentialReader = {
    findByEmail: async (email) => (email === account.email ? account : undefined),
    findById: async (accountId) => (accountId === account.id ? account : undefined),
  };
  const repository: SessionRepository = {
    create: async (session) => {
      storedSession = session;
    },
    findActiveByTokenHash: async (tokenHash, now) => {
      if (
        storedSession === undefined ||
        storedSession.tokenHash !== tokenHash ||
        storedSession.revokedAt !== null ||
        storedSession.expiresAt <= now
      ) {
        return undefined;
      }
      storedSession = { ...storedSession, lastUsedAt: now };
      return storedSession;
    },
    revoke: async (sessionId, revokedAt) => {
      if (storedSession?.id !== sessionId || storedSession.revokedAt !== null) return false;
      storedSession = { ...storedSession, revokedAt };
      return true;
    },
  };
  const passwordHasher: PasswordHasher = {
    hash: async () => "unused",
    verify: async (passwordHash, password) =>
      passwordHash === account.passwordHash && password === "secret",
  };
  const tokenGenerator: SessionTokenGenerator = {
    create: () => ({ value: "galaxis_session_http", hash: "http-token-hash" }),
    hash: (value) => (value === "galaxis_session_http" ? "http-token-hash" : "wrong-hash"),
  };

  return new SessionService({
    accountReader,
    passwordHasher,
    sessionRepository: repository,
    tokenGenerator,
    idGenerator: new FakeIdGenerator(),
    wallClock: new FakeWallClock(Date.UTC(2026, 0, 2)),
    sessionLifetimeMs: 7 * 24 * 60 * 60 * 1000,
    dummyPasswordHash: "dummy-password-hash",
  });
}

describe("session HTTP contract", () => {
  it("creates, checks, exposes identity to protected routes, and revokes a session", async () => {
    const sessionService = createSessionService();
    const server = createServer(config, { sessionService });
    server.get(
      "/api/v1/test/protected",
      {
        preHandler: authenticateSession(sessionService),
        schema: { response: { 200: Type.Object({ accountId: Type.String() }) } },
      },
      async (request) => ({ accountId: request.authIdentity?.accountId ?? "missing" }),
    );

    try {
      const created = await server.inject({
        method: "POST",
        url: "/api/v1/auth/sessions",
        headers: { "content-type": "application/json" },
        payload: { email: "CAPTAIN@example.test", password: "secret" },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        sessionId: "ses_fake_0001",
        accountId: account.id,
        token: "galaxis_session_http",
      });
      expect(created.body).not.toContain("secret");

      const token = "galaxis_session_http";
      const current = await server.inject({
        method: "GET",
        url: "/api/v1/auth/session",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(current.statusCode).toBe(200);
      expect(current.json()).not.toHaveProperty("token");

      const protectedResponse = await server.inject({
        method: "GET",
        url: "/api/v1/test/protected",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(protectedResponse.statusCode).toBe(200);
      expect(protectedResponse.json()).toEqual({ accountId: account.id });

      const revoked = await server.inject({
        method: "DELETE",
        url: "/api/v1/auth/sessions/current",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(revoked.statusCode).toBe(204);
      expect(revoked.body).toBe("");

      const afterRevoke = await server.inject({
        method: "GET",
        url: "/api/v1/auth/session",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(afterRevoke.statusCode).toBe(401);
      expect(afterRevoke.json()).toMatchObject({
        error: {
          code: "SESSION_INVALID",
          message: "Es ist keine gültige Session vorhanden.",
          retryable: false,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("rejects wrong credentials and malformed authorization uniformly", async () => {
    const server = createServer(config, { sessionService: createSessionService() });

    try {
      const wrongCredentials = await server.inject({
        method: "POST",
        url: "/api/v1/auth/sessions",
        headers: { "content-type": "application/json" },
        payload: { email: account.email, password: "wrong" },
      });
      const invalidToken = await server.inject({
        method: "GET",
        url: "/api/v1/auth/session",
        headers: { authorization: "Basic not-a-bearer-token" },
      });

      expect(wrongCredentials.statusCode).toBe(401);
      expect(invalidToken.statusCode).toBe(401);
      expect(wrongCredentials.body).not.toContain("wrong");
      expect(invalidToken.json().error.code).toBe("SESSION_INVALID");
    } finally {
      await server.close();
    }
  });
});

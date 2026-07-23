import { describe, expect, it } from "vitest";

import { ApplicationError } from "../../src/application/errors.js";
import type { CampaignResponse } from "../../src/application/campaigns/service.js";
import type { SessionService } from "../../src/application/sessions/service.js";
import { createServer } from "../../src/app/composition-root/server.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";

const config = loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" });

const campaign: CampaignResponse = {
  campaignId: "cmp_contract_0001",
  type: "singleplayer",
  status: "running",
  seed: 42,
  timeProfile: "standard",
  balancingVersion: "0.1.0-baseline",
  catalogVersion: "0.1.0-baseline",
  balancingHash: "a".repeat(64),
  stateVersion: 1,
  createdAt: "2026-01-02T00:00:00.000Z",
};

function createTestServer() {
  const sessionService: Pick<SessionService, "authenticate" | "create" | "current" | "revoke"> = {
    authenticate: async (token: string) => {
      if (token !== "valid-token") {
        throw new ApplicationError("SESSION_INVALID", "Es ist keine gültige Session vorhanden.");
      }
      return { sessionId: "ses_1", accountId: "acc_1", email: "user@example.test" };
    },
    create: async () => {
      throw new Error("not used in this test");
    },
    current: async () => {
      throw new Error("not used in this test");
    },
    revoke: async () => {
      throw new Error("not used in this test");
    },
  };

  return createServer(config, {
    sessionService,
    campaignService: {
      create: async () => campaign,
      list: async () => [campaign],
      get: async () => campaign,
    },
  });
}

describe("campaign REST routes", () => {
  it("requires a session and handles create/list/get", async () => {
    const server = createTestServer();
    try {
      const unauthorized = await server.inject({ method: "GET", url: "/api/v1/campaigns" });
      expect(unauthorized.statusCode).toBe(401);

      const headers = {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      };
      const created = await server.inject({
        method: "POST",
        url: "/api/v1/campaigns",
        headers: { ...headers, "idempotency-key": "create-1" },
        payload: { seed: 42, timeProfile: "standard" },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toEqual(campaign);

      const listed = await server.inject({
        method: "GET",
        url: "/api/v1/campaigns",
        headers,
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toEqual({ campaigns: [campaign] });

      const fetched = await server.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_contract_0001",
        headers,
      });
      expect(fetched.statusCode).toBe(200);
      expect(fetched.json()).toEqual(campaign);
    } finally {
      await server.close();
    }
  });

  it("rejects a create request without an idempotency key", async () => {
    const server = createTestServer();
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/campaigns",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        payload: { seed: 42, timeProfile: "standard" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    } finally {
      await server.close();
    }
  });
});

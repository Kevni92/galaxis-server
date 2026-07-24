// Feature: GAL-API-A1-STATE-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.md

import { describe, expect, it } from "vitest";

import { createServer } from "../../src/app/composition-root/server.js";
import { ApplicationError } from "../../src/application/errors.js";
import type { StateQueryService } from "../../src/application/state/service.js";
import type { SessionService } from "../../src/application/sessions/service.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";

const config = loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" });
const identity = { sessionId: "ses_1", accountId: "acc_owner", email: "owner@example.test" };

const sessionService: Pick<SessionService, "authenticate" | "create" | "current" | "revoke"> = {
  async authenticate(token: string) {
    if (token !== "valid-token") {
      throw new ApplicationError("SESSION_INVALID", "Keine gültige Session.");
    }
    return identity;
  },
  create() {
    throw new Error("not used");
  },
  current() {
    throw new Error("not used");
  },
  revoke() {
    throw new Error("not used");
  },
};

const campaignState = {
  campaignId: "cmp_1",
  status: "running" as const,
  timeProfile: "standard",
  campaignTimeMs: 0,
  stateVersion: 1,
  generatedAt: "2026-01-02T00:00:00.000Z",
  balancingVersion: "0.1.0-baseline",
  balancingHash: "h".repeat(64),
  controlledEmpire: { empireId: "emp_1", name: "Startreich", canControl: true },
  links: { self: "/api/v1/campaigns/cmp_1/state" },
};

const stateService: Pick<
  StateQueryService,
  "getCampaignState" | "getGalaxyOverview" | "getSystemDetail" | "getColonyOverview"
> = {
  async getCampaignState() {
    return campaignState;
  },
  async getGalaxyOverview() {
    return {
      campaignId: "cmp_1",
      stateVersion: 1,
      generatedAt: "2026-01-02T00:00:00.000Z",
      startSystemId: "sys_0001",
      knownSystems: [
        {
          systemId: "sys_0001",
          regionId: "region_0001",
          knowledgeLevel: "explored",
          displayNameKey: "system.sys_0001.name",
          galaxyPosition: { x: 0, y: 0, z: 0 },
          renderKind: "star_system",
          starCount: 1,
          planetCount: 3,
          links: { self: "/api/v1/campaigns/cmp_1/systems/sys_0001" },
        },
      ],
      knownConnections: [],
    };
  },
  async getSystemDetail(accountId, campaignId, systemId) {
    if (systemId !== "sys_0001") {
      throw new ApplicationError("RESOURCE_NOT_FOUND", "Nicht gefunden.", { retryable: false });
    }
    return {
      campaignId: "cmp_1",
      stateVersion: 1,
      generatedAt: "2026-01-02T00:00:00.000Z",
      systemId: "sys_0001",
      regionId: "region_0001",
      knowledgeLevel: "explored",
      displayNameKey: "system.sys_0001.name",
      stars: [
        {
          starId: "star_0001",
          objectType: "star",
          systemId: "sys_0001",
          knowledgeLevel: "explored",
          displayNameKey: "star.star_0001.name",
          localPosition: { x: 0, y: 0 },
          renderKind: "yellow_star",
          starClass: "yellow",
          links: { self: "/api/v1/campaigns/cmp_1/systems/sys_0001" },
        },
      ],
      planets: [
        {
          planetId: "planet_0001_01",
          objectType: "planet",
          systemId: "sys_0001",
          knowledgeLevel: "explored",
          displayNameKey: "planet.planet_0001_01.name",
          localPosition: { x: 120.5, y: -44 },
          renderKind: "terrestrial_planet",
          category: "terrestrial",
          size: "medium",
          homeworldEligible: true,
          links: {
            self: "/api/v1/campaigns/cmp_1/systems/sys_0001",
            colonies: "/api/v1/campaigns/cmp_1/empires/emp_1/colonies",
          },
        },
      ],
      links: {
        self: "/api/v1/campaigns/cmp_1/systems/sys_0001",
        galaxy: "/api/v1/campaigns/cmp_1/galaxy",
      },
    };
  },
  async getColonyOverview() {
    return {
      campaignId: "cmp_1",
      empireId: "emp_1",
      stateVersion: 1,
      generatedAt: "2026-01-02T00:00:00.000Z",
      colonies: [],
    };
  },
};

function server() {
  return createServer(config, { stateService, sessionService });
}

describe("A1 state query routes", () => {
  it("returns the campaign state with an ETag for an authenticated reader", async () => {
    const app = server();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_1/state",
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(campaignState);
      expect(response.headers.etag).toBe('W/"state-1"');
      expect(response.headers["cache-control"]).toContain("private");
    } finally {
      await app.close();
    }
  });

  it("answers a matching If-None-Match with 304 Not Modified", async () => {
    const app = server();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_1/state",
        headers: { authorization: "Bearer valid-token", "if-none-match": 'W/"state-1"' },
      });

      expect(response.statusCode).toBe(304);
      expect(response.body).toBe("");
    } finally {
      await app.close();
    }
  });

  it("returns only the known galaxy systems", async () => {
    const app = server();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_1/galaxy",
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.knownSystems).toHaveLength(1);
      expect(body.knownSystems[0].systemId).toBe("sys_0001");
    } finally {
      await app.close();
    }
  });

  it("hides an unknown system as a 404", async () => {
    const app = server();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_1/systems/sys_9999",
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("RESOURCE_NOT_FOUND");
    } finally {
      await app.close();
    }
  });

  it("rejects an unauthenticated request", async () => {
    const app = server();
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/campaigns/cmp_1/state" });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});

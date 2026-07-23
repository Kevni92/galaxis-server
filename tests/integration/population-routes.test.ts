// Feature: GAL-POP-START-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.md

import { describe, expect, it } from "vitest";

import { createServer } from "../../src/app/composition-root/server.js";
import { ApplicationError } from "../../src/application/errors.js";
import type { PopulationService } from "../../src/application/population/service.js";
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

const populationSummary = {
  campaignId: "cmp_1",
  empireId: "emp_1",
  colonyId: "col_1",
  systemId: "sys_1",
  totalPopulation: 1000,
  employablePopulation: 600,
  employedPopulation: 564,
  unemployedPopulation: 36,
  nonWorkforcePopulation: 400,
};

const economySummary = {
  campaignId: "cmp_1",
  empireId: "emp_1",
  colonyId: "col_1",
  systemId: "sys_1",
  essentialSupply: { quantity: 7_000_000, reserved: 0, available: 7_000_000, coverageDays: 7 },
};

const populationService: Pick<PopulationService, "getPopulationSummary" | "getEconomySummary"> = {
  async getPopulationSummary(accountId, campaignId, empireId) {
    if (empireId !== "emp_1") {
      throw new ApplicationError("RESOURCE_NOT_FOUND", "Nicht gefunden.", { retryable: false });
    }
    return { ...populationSummary, campaignId, empireId };
  },
  async getEconomySummary(accountId, campaignId, empireId) {
    return { ...economySummary, campaignId, empireId };
  },
};

function server() {
  return createServer(config, { populationService, sessionService });
}

describe("population and economy routes", () => {
  it("returns the decision-relevant population summary for an authenticated reader", async () => {
    const app = server();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_1/empires/emp_1/population",
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(populationSummary);
    } finally {
      await app.close();
    }
  });

  it("returns the essential supply reserve summary", async () => {
    const app = server();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_1/empires/emp_1/economy",
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(economySummary);
    } finally {
      await app.close();
    }
  });

  it("rejects an unauthenticated request", async () => {
    const app = server();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_1/empires/emp_1/population",
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("hides a resource the reader may not access as a not-found error", async () => {
    const app = server();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/campaigns/cmp_1/empires/emp_hidden/population",
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("RESOURCE_NOT_FOUND");
    } finally {
      await app.close();
    }
  });
});

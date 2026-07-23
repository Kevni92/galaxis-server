import { describe, expect, it } from "vitest";

import { StateQueryService } from "../../src/application/state/service.js";
import type { CampaignRepository } from "../../src/application/campaigns/ports.js";
import type { ColonyRepository, HomeColonyView } from "../../src/application/colonies/ports.js";
import type {
  EmpireRepository,
  EmpireWithController,
} from "../../src/application/empires/ports.js";
import type { Campaign } from "../../src/domain/campaigns/campaign.js";
import { GALAXY_GENERATOR_VERSION, SMALL_GALAXY_PROFILE } from "../../src/domain/galaxy/galaxy.js";
import { DeterministicGalaxyGenerator } from "../../src/infrastructure/galaxy/generator.js";

const SEED = 42;
const generator = new DeterministicGalaxyGenerator();
const galaxy = generator.generate({
  seed: SEED,
  generatorVersion: GALAXY_GENERATOR_VERSION,
  profile: SMALL_GALAXY_PROFILE,
}).galaxy;
const homeSystemId = galaxy.startSystemId;
const otherSystemId = galaxy.systems.map((system) => system.id).find((id) => id !== homeSystemId)!;

const campaign: Campaign = {
  id: "cmp_1",
  ownerAccountId: "acc_owner",
  type: "singleplayer",
  status: "running",
  seed: SEED,
  timeProfile: "standard",
  balancingVersion: "0.1.0-baseline",
  catalogVersion: "0.1.0-baseline",
  balancingHash: "h".repeat(64),
  stateVersion: 1,
  campaignTimeMs: 0,
  createdAt: Date.UTC(2026, 0, 2),
  idempotencyKey: "create-1",
  creationFingerprint: '[42,"standard"]',
};

const empire: EmpireWithController = {
  empire: {
    id: "emp_1",
    campaignId: "cmp_1",
    name: "Startreich",
    status: "aktiv",
    knowledge: { knownSystemIds: [homeSystemId], knownPlanetIds: ["pln_1"] },
  },
  controller: {
    empireId: "emp_1",
    accountId: "acc_owner",
    controllerType: "player",
    canRead: true,
    canControl: true,
  },
};

const homeColony: HomeColonyView = {
  colony: {
    id: "col_1",
    campaignId: "cmp_1",
    empireId: "emp_1",
    planetId: "pln_1",
    systemId: homeSystemId,
    isHomeColony: true,
    lifecycleState: "etabliert",
    specialization: "neutral",
  },
  planet: {
    id: "pln_1",
    systemId: homeSystemId,
    campaignId: "cmp_1",
    ownerEmpireId: "emp_1",
    category: "terrestrial",
    size: "medium",
  },
};

class FakeCampaignRepository implements CampaignRepository {
  public constructor(private readonly campaign: Campaign | undefined) {}
  public async create() {
    return { kind: "conflict" as const };
  }
  public async listForAccount() {
    return this.campaign === undefined ? [] : [this.campaign];
  }
  public async findForAccount(accountId: string) {
    return this.campaign !== undefined && accountId === this.campaign.ownerAccountId
      ? this.campaign
      : undefined;
  }
}

class FakeEmpireRepository implements EmpireRepository {
  public constructor(private readonly empire: EmpireWithController | undefined) {}
  public async listReadableForAccount() {
    return this.empire === undefined ? [] : [this.empire];
  }
  public async findReadableForAccount() {
    return this.empire;
  }
}

class FakeColonyRepository implements ColonyRepository {
  public constructor(private readonly view: HomeColonyView | undefined) {}
  public async findHomeColonyForEmpire() {
    return this.view;
  }
}

function createService(
  overrides: {
    campaign?: Campaign | undefined;
    empire?: EmpireWithController | undefined;
    colony?: HomeColonyView | undefined;
  } = {},
): StateQueryService {
  return new StateQueryService({
    campaignRepository: new FakeCampaignRepository(
      "campaign" in overrides ? overrides.campaign : campaign,
    ),
    empireRepository: new FakeEmpireRepository("empire" in overrides ? overrides.empire : empire),
    colonyRepository: new FakeColonyRepository(
      "colony" in overrides ? overrides.colony : homeColony,
    ),
    galaxyGenerator: generator,
  });
}

describe("StateQueryService campaign state", () => {
  it("summarizes the campaign and controlled empire with detail links", async () => {
    const state = await createService().getCampaignState("acc_owner", "cmp_1");

    expect(state).toMatchObject({
      campaignId: "cmp_1",
      status: "running",
      stateVersion: 1,
      balancingVersion: "0.1.0-baseline",
      controlledEmpire: { empireId: "emp_1", name: "Startreich", canControl: true },
    });
    expect(state.links.galaxy).toBe("/api/v1/campaigns/cmp_1/galaxy");
    expect(state.links.colonies).toBe("/api/v1/campaigns/cmp_1/empires/emp_1/colonies");
  });

  it("hides a campaign the account may not read", async () => {
    await expect(createService().getCampaignState("intruder", "cmp_1")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("rejects an empty session identity", async () => {
    await expect(createService().getCampaignState("", "cmp_1")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("StateQueryService galaxy overview", () => {
  it("returns only the known home system and no unknown systems", async () => {
    const overview = await createService().getGalaxyOverview("acc_owner", "cmp_1");

    expect(overview.startSystemId).toBe(homeSystemId);
    expect(overview.knownSystems).toHaveLength(1);
    expect(overview.knownSystems[0]?.systemId).toBe(homeSystemId);
    // Kein unbekanntes System und keine Verbindung mit unbekanntem Endpunkt.
    expect(overview.knownSystems.map((system) => system.systemId)).not.toContain(otherSystemId);
    for (const connection of overview.knownConnections) {
      expect(connection.fromSystemId).toBe(homeSystemId);
      expect(connection.toSystemId).toBe(homeSystemId);
    }
  });
});

describe("StateQueryService system detail", () => {
  it("returns the known home system with its planets", async () => {
    const detail = await createService().getSystemDetail("acc_owner", "cmp_1", homeSystemId);

    expect(detail.systemId).toBe(homeSystemId);
    expect(detail.stars.length).toBeGreaterThan(0);
    expect(detail.planets.length).toBeGreaterThan(0);
  });

  it("hides an unknown system as a not-found resource without leaking its existence", async () => {
    await expect(
      createService().getSystemDetail("acc_owner", "cmp_1", otherSystemId),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});

describe("StateQueryService colony overview", () => {
  it("returns the home colony with its planet and links", async () => {
    const overview = await createService().getColonyOverview("acc_owner", "cmp_1", "emp_1");

    expect(overview.colonies).toHaveLength(1);
    expect(overview.colonies[0]).toMatchObject({
      colonyId: "col_1",
      systemId: homeSystemId,
      isHomeColony: true,
      lifecycleState: "etabliert",
      specialization: "neutral",
      planet: { category: "terrestrial", size: "medium" },
    });
  });

  it("hides colonies of an empire in a different campaign", async () => {
    await expect(
      createService().getColonyOverview("acc_owner", "cmp_other", "emp_1"),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("returns an empty list when no home colony exists yet", async () => {
    const overview = await createService({ colony: undefined }).getColonyOverview(
      "acc_owner",
      "cmp_1",
      "emp_1",
    );
    expect(overview.colonies).toEqual([]);
  });
});

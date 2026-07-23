import { describe, expect, it } from "vitest";

import { CampaignPersistenceService } from "../../src/application/campaigns/persistence.js";
import type {
  CampaignSnapshot,
  CampaignStateStore,
  StateChangeResult,
} from "../../src/application/campaigns/state-store.js";
import { InMemoryBalancingLoader } from "../../src/infrastructure/balancing/loader.js";

const balancingDocument = {
  schemaVersion: "1.0",
  balancingVersion: "0.1.0-baseline",
  catalogVersion: "0.1.0-baseline",
  status: "baseline",
  effectiveFrom: "new_campaigns",
  sources: ["test"],
  units: ["campaign_seconds"],
  parameters: {},
};

const loader = new InMemoryBalancingLoader(balancingDocument);

function baseSnapshot(hash: string): CampaignSnapshot {
  return {
    campaign: {
      id: "cmp_1",
      ownerAccountId: "acc_owner",
      type: "singleplayer",
      status: "running",
      seed: 42,
      timeProfile: "standard",
      balancingVersion: "0.1.0-baseline",
      catalogVersion: "0.1.0-baseline",
      balancingHash: hash,
      stateVersion: 1,
      campaignTimeMs: 0,
      createdAt: Date.UTC(2026, 0, 2),
      idempotencyKey: "create-1",
      creationFingerprint: '[42,"standard"]',
    },
    empire: {
      id: "emp_1",
      campaignId: "cmp_1",
      name: "Startreich",
      status: "aktiv",
      knowledge: { knownSystemIds: ["sys_0001"], knownPlanetIds: ["pln_1"] },
    },
    controller: {
      empireId: "emp_1",
      accountId: "acc_owner",
      controllerType: "player",
      canRead: true,
      canControl: true,
    },
    planet: {
      id: "pln_1",
      systemId: "sys_0001",
      campaignId: "cmp_1",
      ownerEmpireId: "emp_1",
      category: "terrestrial",
      size: "medium",
    },
    colony: {
      id: "col_1",
      campaignId: "cmp_1",
      empireId: "emp_1",
      planetId: "pln_1",
      systemId: "sys_0001",
      isHomeColony: true,
      lifecycleState: "etabliert",
      specialization: "neutral",
    },
    populationGroup: {
      id: "pop_1",
      campaignId: "cmp_1",
      colonyId: "col_1",
      origin: "neutral",
      total: 1000,
      employable: 600,
      employed: 564,
    },
    essentialSupplyStock: {
      id: "stk_1",
      campaignId: "cmp_1",
      colonyId: "col_1",
      quantity: 7_000_000,
      reserved: 0,
      coverageDays: 7,
    },
  };
}

class FakeStore implements CampaignStateStore {
  public constructor(
    private readonly change: StateChangeResult,
    private readonly snapshot: CampaignSnapshot | undefined,
  ) {}
  public async applyStateChange(): Promise<StateChangeResult> {
    return this.change;
  }
  public async loadSnapshot(): Promise<CampaignSnapshot | undefined> {
    return this.snapshot;
  }
}

async function currentHash(): Promise<string> {
  return (await loader.load()).hash;
}

describe("CampaignPersistenceService state change", () => {
  it("reports the new state version on a successful atomic change", async () => {
    const service = new CampaignPersistenceService({
      stateStore: new FakeStore({ kind: "applied", stateVersion: 2 }, undefined),
      balancingLoader: loader,
    });

    await expect(service.applyStateChange("cmp_1", 1)).resolves.toEqual({
      campaignId: "cmp_1",
      stateVersion: 2,
    });
  });

  it("maps a concurrency conflict to a retryable-safe CONFLICT", async () => {
    const service = new CampaignPersistenceService({
      stateStore: new FakeStore({ kind: "conflict", currentStateVersion: 5 }, undefined),
      balancingLoader: loader,
    });

    await expect(service.applyStateChange("cmp_1", 1)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("maps a missing campaign to RESOURCE_NOT_FOUND", async () => {
    const service = new CampaignPersistenceService({
      stateStore: new FakeStore({ kind: "not_found" }, undefined),
      balancingLoader: loader,
    });

    await expect(service.applyStateChange("cmp_missing", 1)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
});

describe("CampaignPersistenceService validated load", () => {
  it("returns a compatible, consistent snapshot", async () => {
    const snapshot = baseSnapshot(await currentHash());
    const service = new CampaignPersistenceService({
      stateStore: new FakeStore({ kind: "not_found" }, snapshot),
      balancingLoader: loader,
    });

    await expect(service.loadValidatedSnapshot("cmp_1")).resolves.toEqual(snapshot);
  });

  it("rejects a snapshot whose balancing hash no longer matches", async () => {
    const snapshot = baseSnapshot("x".repeat(64));
    const service = new CampaignPersistenceService({
      stateStore: new FakeStore({ kind: "not_found" }, snapshot),
      balancingLoader: loader,
    });

    await expect(service.loadValidatedSnapshot("cmp_1")).rejects.toMatchObject({
      code: "CAMPAIGN_INCOMPATIBLE",
    });
  });

  it("rejects a referentially inconsistent snapshot", async () => {
    const snapshot = baseSnapshot(await currentHash());
    const broken: CampaignSnapshot = {
      ...snapshot,
      colony: { ...snapshot.colony, planetId: "pln_other" },
    };
    const service = new CampaignPersistenceService({
      stateStore: new FakeStore({ kind: "not_found" }, broken),
      balancingLoader: loader,
    });

    await expect(service.loadValidatedSnapshot("cmp_1")).rejects.toMatchObject({
      code: "CAMPAIGN_INCOMPATIBLE",
    });
  });

  it("reports a missing campaign as RESOURCE_NOT_FOUND", async () => {
    const service = new CampaignPersistenceService({
      stateStore: new FakeStore({ kind: "not_found" }, undefined),
      balancingLoader: loader,
    });

    await expect(service.loadValidatedSnapshot("cmp_missing")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
});

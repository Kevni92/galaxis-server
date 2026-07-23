import { describe, expect, it } from "vitest";

import { CampaignService } from "../../src/application/campaigns/service.js";
import type { CampaignRepository } from "../../src/application/campaigns/ports.js";
import type { Campaign } from "../../src/domain/campaigns/campaign.js";
import { InMemoryBalancingLoader } from "../../src/infrastructure/balancing/loader.js";
import { FakeWallClock } from "../../src/infrastructure/runtime/clocks.js";
import { FakeIdGenerator } from "../../src/infrastructure/runtime/ids.js";
import { DeterministicGalaxyGenerator } from "../../src/infrastructure/galaxy/generator.js";
import type { GalaxyGenerator } from "../../src/application/galaxy/ports.js";

const balancingLoader = new InMemoryBalancingLoader({
  schemaVersion: "1.0",
  balancingVersion: "0.1.0-baseline",
  catalogVersion: "0.1.0-baseline",
  status: "baseline",
  effectiveFrom: "new_campaigns",
  sources: ["test"],
  units: ["campaign_seconds"],
  parameters: {},
});

class FakeCampaignRepository implements CampaignRepository {
  private readonly campaigns = new Map<string, Campaign>();

  public async create(campaign: Campaign) {
    const key = `${campaign.ownerAccountId}:${campaign.idempotencyKey}`;
    const existing = [...this.campaigns.values()].find(
      (candidate) => `${candidate.ownerAccountId}:${candidate.idempotencyKey}` === key,
    );
    if (existing === undefined) {
      this.campaigns.set(campaign.id, campaign);
      return { kind: "created" as const, campaign };
    }
    return existing.creationFingerprint === campaign.creationFingerprint
      ? { kind: "existing" as const, campaign: existing }
      : { kind: "conflict" as const };
  }

  public async listForAccount(accountId: string) {
    return [...this.campaigns.values()].filter((campaign) => campaign.ownerAccountId === accountId);
  }

  public async findForAccount(accountId: string, campaignId: string) {
    const campaign = this.campaigns.get(campaignId);
    return campaign?.ownerAccountId === accountId ? campaign : undefined;
  }
}

function createService(
  repository = new FakeCampaignRepository(),
  galaxyGenerator: GalaxyGenerator = new DeterministicGalaxyGenerator(),
) {
  return {
    service: new CampaignService({
      repository,
      balancingLoader,
      idGenerator: new FakeIdGenerator(),
      wallClock: new FakeWallClock(Date.UTC(2026, 0, 2)),
      galaxyGenerator,
    }),
    repository,
  };
}

describe("CampaignService", () => {
  it("creates a campaign with versioned metadata and stateVersion one", async () => {
    const { service } = createService();

    await expect(
      service.create({
        accountId: "acc_owner",
        seed: 42,
        timeProfile: "standard",
        idempotencyKey: "create-1",
      }),
    ).resolves.toEqual({
      campaignId: "cmp_fake_0001",
      type: "singleplayer",
      status: "running",
      seed: 42,
      timeProfile: "standard",
      balancingVersion: "0.1.0-baseline",
      catalogVersion: "0.1.0-baseline",
      balancingHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      stateVersion: 1,
      createdAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("returns the original campaign for an identical retry", async () => {
    const { service, repository } = createService();
    const request = {
      accountId: "acc_owner",
      seed: 42,
      timeProfile: "standard",
      idempotencyKey: "create-1",
    };

    const first = await service.create(request);
    const second = await service.create(request);

    expect(second).toEqual(first);
    await expect(service.list("acc_owner")).resolves.toHaveLength(1);
    await expect(repository.listForAccount("other-account")).resolves.toEqual([]);
  });

  it("rejects reuse of an idempotency key with different campaign data", async () => {
    const { service } = createService();
    const request = {
      accountId: "acc_owner",
      seed: 42,
      timeProfile: "standard",
      idempotencyKey: "create-1",
    };

    await service.create(request);
    await expect(service.create({ ...request, seed: 43 })).rejects.toMatchObject({
      code: "CAMPAIGN_CREATE_CONFLICT",
    });
  });

  it("does not reveal another account's campaign", async () => {
    const { service } = createService();
    const campaign = await service.create({
      accountId: "acc_owner",
      seed: 42,
      timeProfile: "standard",
      idempotencyKey: "create-1",
    });

    await expect(service.get("other-account", campaign.campaignId)).rejects.toMatchObject({
      code: "CAMPAIGN_NOT_FOUND",
    });
  });

  it("rejects a failed galaxy generation before repository persistence", async () => {
    const repository = new FakeCampaignRepository();
    const galaxyGenerator: GalaxyGenerator = {
      generate: () => {
        throw new RangeError("invalid galaxy profile");
      },
    };
    const { service } = createService(repository, galaxyGenerator);

    await expect(
      service.create({
        accountId: "acc_owner",
        seed: 42,
        timeProfile: "standard",
        idempotencyKey: "create-1",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CAMPAIGN" });
    await expect(repository.listForAccount("acc_owner")).resolves.toEqual([]);
  });
});

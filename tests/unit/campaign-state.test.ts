import { describe, expect, it } from "vitest";

import type { Campaign } from "../../src/domain/campaigns/campaign.js";
import {
  StateVersionConflictError,
  nextStateVersion,
  validateCampaignLoad,
} from "../../src/domain/campaigns/state.js";

const balancing = {
  balancingVersion: "0.1.0-baseline",
  catalogVersion: "0.1.0-baseline",
  hash: "h".repeat(64),
};

const campaign: Campaign = {
  id: "cmp_1",
  ownerAccountId: "acc_owner",
  type: "singleplayer",
  status: "running",
  seed: 42,
  timeProfile: "standard",
  balancingVersion: balancing.balancingVersion,
  catalogVersion: balancing.catalogVersion,
  balancingHash: balancing.hash,
  stateVersion: 3,
  campaignTimeMs: 0,
  createdAt: Date.UTC(2026, 0, 2),
  idempotencyKey: "create-1",
  creationFingerprint: '[42,"standard"]',
};

describe("optimistic state version transition", () => {
  it("advances by exactly one when the expected version is current", () => {
    expect(nextStateVersion(5, 5)).toBe(6);
  });

  it("rejects a stale expected version as a concurrency conflict", () => {
    expect(() => nextStateVersion(6, 5)).toThrow(StateVersionConflictError);
    try {
      nextStateVersion(6, 5);
    } catch (error) {
      expect(error).toBeInstanceOf(StateVersionConflictError);
      expect((error as StateVersionConflictError).current).toBe(6);
      expect((error as StateVersionConflictError).expected).toBe(5);
    }
  });

  it("rejects non-positive versions", () => {
    expect(() => nextStateVersion(0, 0)).toThrow(RangeError);
  });
});

describe("campaign load validation against balancing identity", () => {
  it("accepts a campaign that matches the loaded balancing identity", () => {
    expect(validateCampaignLoad(campaign, balancing)).toEqual([]);
  });

  it("rejects a mismatching balancing version", () => {
    const issues = validateCampaignLoad({ ...campaign, balancingVersion: "0.2.0" }, balancing);
    expect(issues).toEqual([
      { kind: "balancing_version_mismatch", expected: "0.1.0-baseline", actual: "0.2.0" },
    ]);
  });

  it("rejects a mismatching balancing hash", () => {
    const issues = validateCampaignLoad({ ...campaign, balancingHash: "x".repeat(64) }, balancing);
    expect(issues).toContainEqual(expect.objectContaining({ kind: "balancing_hash_mismatch" }));
  });

  it("rejects an invalid state version", () => {
    const issues = validateCampaignLoad({ ...campaign, stateVersion: 0 }, balancing);
    expect(issues).toContainEqual({ kind: "invalid_state_version", actual: 0 });
  });
});

// Feature: GAL-CAMPAIGN-CREATE-001
// Fachliche Grundlage: docs/docs/11-campaign/kampagnenstruktur.md
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.md

export type CampaignType = "singleplayer";
export type CampaignStatus = "running";

export interface Campaign {
  readonly id: string;
  readonly ownerAccountId: string;
  readonly type: CampaignType;
  readonly status: CampaignStatus;
  readonly seed: number;
  readonly timeProfile: string;
  readonly balancingVersion: string;
  readonly catalogVersion: string;
  readonly balancingHash: string;
  readonly stateVersion: number;
  readonly campaignTimeMs: number;
  readonly createdAt: number;
  readonly idempotencyKey: string;
  readonly creationFingerprint: string;
}

export function assertCampaignCreationValues(values: {
  readonly accountId: string;
  readonly seed: number;
  readonly timeProfile: string;
  readonly idempotencyKey: string;
}): void {
  if (values.accountId.length === 0) throw new RangeError("accountId must not be empty");
  if (!Number.isSafeInteger(values.seed) || values.seed < 0) {
    throw new RangeError("seed must be a non-negative safe integer");
  }
  if (values.timeProfile.trim().length === 0) {
    throw new RangeError("timeProfile must not be empty");
  }
  if (values.idempotencyKey.trim().length === 0) {
    throw new RangeError("idempotencyKey must not be empty");
  }
}

export function campaignCreationFingerprint(seed: number, timeProfile: string): string {
  return JSON.stringify([seed, timeProfile]);
}

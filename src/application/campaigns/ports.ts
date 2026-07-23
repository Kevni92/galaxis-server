// Feature: GAL-CAMPAIGN-CREATE-001
// Fachliche Grundlage: docs/docs/11-campaign/kampagnenstruktur.md

import type { Campaign } from "../../domain/campaigns/campaign.js";

export type CampaignCreateResult =
  | { readonly kind: "created"; readonly campaign: Campaign }
  | { readonly kind: "existing"; readonly campaign: Campaign }
  | { readonly kind: "conflict" };

export interface CampaignRepository {
  create(campaign: Campaign): Promise<CampaignCreateResult>;
  listForAccount(accountId: string): Promise<readonly Campaign[]>;
  findForAccount(accountId: string, campaignId: string): Promise<Campaign | undefined>;
}

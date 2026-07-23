// Feature: GAL-CAMPAIGN-CREATE-001, GAL-EMPIRE-START-001
// Fachliche Grundlage: docs/docs/11-campaign/kampagnenstruktur.md
// Fachliche Grundlage: docs/docs/03-empires/reichsverwaltung.md

import type { Campaign } from "../../domain/campaigns/campaign.js";
import type { Empire, EmpireController } from "../../domain/empires/empire.js";

export interface CampaignCreation {
  readonly campaign: Campaign;
  readonly empire: Empire;
  readonly controller: EmpireController;
}

export type CampaignCreateResult =
  | { readonly kind: "created"; readonly campaign: Campaign }
  | { readonly kind: "existing"; readonly campaign: Campaign }
  | { readonly kind: "conflict" };

export interface CampaignRepository {
  create(creation: CampaignCreation): Promise<CampaignCreateResult>;
  listForAccount(accountId: string): Promise<readonly Campaign[]>;
  findForAccount(accountId: string, campaignId: string): Promise<Campaign | undefined>;
}

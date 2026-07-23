// Feature: GAL-PERSIST-A1-001
// Fachliche Grundlage: docs/decisions/0004-versionierte-balancing-schicht.md

import type { Campaign } from "../../domain/campaigns/campaign.js";
import type { Empire, EmpireController } from "../../domain/empires/empire.js";
import type { Colony, HomePlanet } from "../../domain/colonies/colony.js";
import type {
  EssentialSupplyStock,
  PopulationGroup,
} from "../../domain/population/start-baseline.js";

/**
 * Vollständiger A1-Aggregatschnappschuss einer Kampagne. Er bündelt genau die
 * persistierten Startaggregate, sodass ein Neustart denselben sichtbaren Zustand
 * rekonstruiert (Galaxie bleibt deterministisch aus dem Seed ableitbar).
 */
export interface CampaignSnapshot {
  readonly campaign: Campaign;
  readonly empire: Empire;
  readonly controller: EmpireController;
  readonly planet: HomePlanet;
  readonly colony: Colony;
  readonly populationGroup: PopulationGroup;
  readonly essentialSupplyStock: EssentialSupplyStock;
}

export type StateChangeResult =
  | { readonly kind: "applied"; readonly stateVersion: number }
  | { readonly kind: "conflict"; readonly currentStateVersion: number }
  | { readonly kind: "not_found" };

export interface CampaignStateStore {
  /**
   * Erhöht die Zustandsversion einer Kampagne atomar von `expectedStateVersion` auf
   * `expectedStateVersion + 1`. Weicht die aktuelle Version ab, meldet der Store einen
   * Konflikt statt einer Änderung (Optimistic Concurrency, Compare-and-Swap).
   */
  applyStateChange(campaignId: string, expectedStateVersion: number): Promise<StateChangeResult>;

  /** Lädt den vollständigen A1-Schnappschuss einer Kampagne oder undefined. */
  loadSnapshot(campaignId: string): Promise<CampaignSnapshot | undefined>;
}

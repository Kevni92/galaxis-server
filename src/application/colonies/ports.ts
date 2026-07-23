// Feature: GAL-COLONY-HOME-001
// Fachliche Grundlage: docs/docs/04-planets/planeten-und-kolonien.md

import type { Colony, HomePlanet } from "../../domain/colonies/colony.js";

export interface HomeColonyView {
  readonly colony: Colony;
  readonly planet: HomePlanet;
}

export interface ColonyRepository {
  /** Die aktive Heimatkolonie eines Reiches samt Heimatplanet, sonst undefined. */
  findHomeColonyForEmpire(
    campaignId: string,
    empireId: string,
  ): Promise<HomeColonyView | undefined>;
}

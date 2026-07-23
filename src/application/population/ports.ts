// Feature: GAL-POP-START-001
// Fachliche Grundlage: docs/docs/05-population/bevoelkerung-und-arbeit.md
// Fachliche Grundlage: docs/docs/06-economy/wirtschaft-und-versorgung.md

import type {
  EssentialSupplyStock,
  PopulationGroup,
} from "../../domain/population/start-baseline.js";

export interface HomeColonyBaselineView {
  readonly colonyId: string;
  readonly systemId: string;
  readonly populationGroup: PopulationGroup;
  readonly essentialSupplyStock: EssentialSupplyStock;
}

export interface StartBaselineRepository {
  /**
   * Startbaseline der Heimatkolonie eines Reiches: aggregierte Bevölkerungsgruppe und
   * essentieller Bestand. `undefined`, wenn keine Heimatkolonie mit Baseline existiert.
   */
  findHomeColonyBaseline(
    campaignId: string,
    empireId: string,
  ): Promise<HomeColonyBaselineView | undefined>;
}

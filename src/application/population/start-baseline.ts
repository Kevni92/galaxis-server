// Feature: GAL-POP-START-001
// Fachliche Grundlage: docs/docs/05-population/bevoelkerung-und-arbeit.md
// Fachliche Grundlage: docs/docs/06-economy/wirtschaft-und-versorgung.md
// Balancing: data/balancing/manifest.json

import type { LoadedBalancingConfiguration } from "../balancing/loader.js";
import { requiredParameter } from "../balancing/parameters.js";
import {
  deriveEssentialSupplyStock,
  deriveStartPopulationGroup,
  type EssentialSupplyStock,
  type PopulationGroup,
  type StartBaselineInputs,
} from "../../domain/population/start-baseline.js";
import type { IdGenerator } from "../runtime/ids.js";

export interface StartBaseline {
  readonly populationGroup: PopulationGroup;
  readonly essentialSupplyStock: EssentialSupplyStock;
}

/**
 * Liest die versionierten Startwerte für Bevölkerung und Grundversorgung. Alle Werte
 * stammen ausschließlich aus der geladenen Balancingkonfiguration.
 */
export function readStartBaselineInputs(
  configuration: LoadedBalancingConfiguration,
): StartBaselineInputs {
  return {
    populationTotal: requiredParameter(configuration, "start_population_total", "population_units"),
    employableShareBasisPoints: requiredParameter(
      configuration,
      "start_population_employable_share",
      "basis_points",
    ),
    employmentShareBasisPoints: requiredParameter(
      configuration,
      "start_employment_share",
      "basis_points",
    ),
    essentialReserveDays: requiredParameter(
      configuration,
      "essential_reserve_target_days",
      "campaign_days",
    ),
    essentialDailyConsumptionPerPop: requiredParameter(
      configuration,
      "essential_daily_consumption_per_pop",
      "quantity_milliunits",
    ),
  };
}

/**
 * Baut die deterministische Startbaseline genau einer Heimatkolonie: eine aggregierte
 * Bevölkerungsgruppe und den essentiellen Startbestand, beide aus denselben Balancingwerten.
 */
export function buildStartBaseline(
  configuration: LoadedBalancingConfiguration,
  identity: { readonly campaignId: string; readonly colonyId: string },
  idGenerator: IdGenerator,
): StartBaseline {
  const inputs = readStartBaselineInputs(configuration);
  const populationGroup = deriveStartPopulationGroup(
    { id: idGenerator.next("pop"), campaignId: identity.campaignId, colonyId: identity.colonyId },
    inputs,
  );
  const essentialSupplyStock = deriveEssentialSupplyStock(
    { id: idGenerator.next("stk"), campaignId: identity.campaignId, colonyId: identity.colonyId },
    inputs,
  );
  return { populationGroup, essentialSupplyStock };
}

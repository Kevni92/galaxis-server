// Feature: GAL-POP-START-001
// Fachliche Grundlage: docs/docs/05-population/bevoelkerung-und-arbeit.md
// Fachliche Grundlage: docs/docs/06-economy/wirtschaft-und-versorgung.md
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.md

import { ApplicationError } from "../errors.js";
import type { EmpireRepository } from "../empires/ports.js";
import type { HomeColonyBaselineView, StartBaselineRepository } from "./ports.js";

export interface PopulationSummaryResponse {
  readonly campaignId: string;
  readonly empireId: string;
  readonly colonyId: string;
  readonly systemId: string;
  readonly stateVersion: number;
  readonly generatedAt: string;
  readonly totalPopulation: number;
  readonly employablePopulation: number;
  readonly employedPopulation: number;
  readonly unemployedPopulation: number;
  readonly nonWorkforcePopulation: number;
}

export interface EconomySummaryResponse {
  readonly campaignId: string;
  readonly empireId: string;
  readonly colonyId: string;
  readonly systemId: string;
  readonly stateVersion: number;
  readonly generatedAt: string;
  readonly essentialSupply: {
    readonly quantity: number;
    readonly reserved: number;
    readonly available: number;
    readonly coverageDays: number;
  };
}

export interface PopulationServiceDependencies {
  readonly empireRepository: EmpireRepository;
  readonly baselineRepository: StartBaselineRepository;
}

/**
 * Liefert entscheidungsrelevante Bevölkerungs- und Wirtschaftszusammenfassungen der
 * Heimatkolonie. Jeder Zugriff wird zuerst gegen den Lesezugriff des Reiches geprüft;
 * Befehlsrecht bleibt getrennt (siehe reichsverwaltung.md).
 */
export class PopulationService {
  private readonly empireRepository: EmpireRepository;
  private readonly baselineRepository: StartBaselineRepository;

  public constructor(dependencies: PopulationServiceDependencies) {
    this.empireRepository = dependencies.empireRepository;
    this.baselineRepository = dependencies.baselineRepository;
  }

  public async getPopulationSummary(
    accountId: string,
    campaignId: string,
    empireId: string,
  ): Promise<PopulationSummaryResponse> {
    const baseline = await this.readableBaseline(accountId, campaignId, empireId);
    const { populationGroup } = baseline;
    return {
      campaignId,
      empireId,
      colonyId: baseline.colonyId,
      systemId: baseline.systemId,
      stateVersion: baseline.stateVersion,
      generatedAt: baseline.generatedAt,
      totalPopulation: populationGroup.total,
      employablePopulation: populationGroup.employable,
      employedPopulation: populationGroup.employed,
      unemployedPopulation: populationGroup.employable - populationGroup.employed,
      nonWorkforcePopulation: populationGroup.total - populationGroup.employable,
    };
  }

  public async getEconomySummary(
    accountId: string,
    campaignId: string,
    empireId: string,
  ): Promise<EconomySummaryResponse> {
    const baseline = await this.readableBaseline(accountId, campaignId, empireId);
    const { essentialSupplyStock } = baseline;
    return {
      campaignId,
      empireId,
      colonyId: baseline.colonyId,
      systemId: baseline.systemId,
      stateVersion: baseline.stateVersion,
      generatedAt: baseline.generatedAt,
      essentialSupply: {
        quantity: essentialSupplyStock.quantity,
        reserved: essentialSupplyStock.reserved,
        available: essentialSupplyStock.quantity - essentialSupplyStock.reserved,
        coverageDays: essentialSupplyStock.coverageDays,
      },
    };
  }

  private async readableBaseline(
    accountId: string,
    campaignId: string,
    empireId: string,
  ): Promise<HomeColonyBaselineView> {
    if (accountId.length === 0) {
      throw new ApplicationError("UNAUTHORIZED", "Keine gültige Session.");
    }
    const empire = await this.empireRepository.findReadableForAccount(accountId, empireId);
    // Fremdes oder unbekanntes Reich bleibt aus Wissensschutz nicht offenlegbar.
    if (empire === undefined || empire.empire.campaignId !== campaignId) {
      throw new ApplicationError(
        "RESOURCE_NOT_FOUND",
        "Die angeforderte Ressource wurde nicht gefunden.",
        { retryable: false },
      );
    }
    const baseline = await this.baselineRepository.findHomeColonyBaseline(campaignId, empireId);
    if (baseline === undefined) {
      throw new ApplicationError(
        "RESOURCE_NOT_FOUND",
        "Die angeforderte Ressource wurde nicht gefunden.",
        { retryable: false },
      );
    }
    return baseline;
  }
}

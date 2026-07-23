// Feature: GAL-PERSIST-A1-001
// Fachliche Grundlage: docs/decisions/0004-versionierte-balancing-schicht.md
// Fachliche Grundlage: docs/TESTING.md

import { ApplicationError } from "../errors.js";
import type { BalancingLoader } from "../balancing/loader.js";
import { validateCampaignLoad } from "../../domain/campaigns/state.js";
import type { CampaignSnapshot, CampaignStateStore } from "./state-store.js";

export interface CampaignPersistenceServiceDependencies {
  readonly stateStore: CampaignStateStore;
  readonly balancingLoader: BalancingLoader;
}

export interface StateChangeResponse {
  readonly campaignId: string;
  readonly stateVersion: number;
}

/**
 * Anwendungsfälle für die atomare Zustandsführung und das validierte Laden einer
 * Kampagne. stateVersion steigt nur bei erfolgreicher atomarer Änderung; inkompatible
 * oder beschädigte Daten werden beim Laden kontrolliert abgelehnt.
 */
export class CampaignPersistenceService {
  private readonly stateStore: CampaignStateStore;
  private readonly balancingLoader: BalancingLoader;

  public constructor(dependencies: CampaignPersistenceServiceDependencies) {
    this.stateStore = dependencies.stateStore;
    this.balancingLoader = dependencies.balancingLoader;
  }

  /**
   * Wendet eine atomare Zustandsänderung mit erwarteter Ausgangsversion an. Ein
   * Nebenläufigkeitskonflikt wird als 409 mit sicherer Aktualisierungsempfehlung
   * gemeldet; die aktuelle Version begleitet den Fehler.
   */
  public async applyStateChange(
    campaignId: string,
    expectedStateVersion: number,
  ): Promise<StateChangeResponse> {
    const result = await this.stateStore.applyStateChange(campaignId, expectedStateVersion);
    if (result.kind === "not_found") {
      throw new ApplicationError(
        "RESOURCE_NOT_FOUND",
        "Die angeforderte Kampagne wurde nicht gefunden.",
        { retryable: false },
      );
    }
    if (result.kind === "conflict") {
      throw new ApplicationError("CONFLICT", "Die sichtbare Ausgangslage ist überholt.", {
        retryable: false,
        details: [{ field: "expectedStateVersion", reason: "STALE" }],
      });
    }
    return { campaignId, stateVersion: result.stateVersion };
  }

  /**
   * Lädt den vollständigen A1-Schnappschuss und validiert ihn gegen die geladene
   * Balancingidentität. Inkompatible Version oder abweichender Hash werden abgelehnt,
   * damit eine laufende Kampagne nicht stillschweigend auf neue Werte wechselt.
   */
  public async loadValidatedSnapshot(campaignId: string): Promise<CampaignSnapshot> {
    const snapshot = await this.stateStore.loadSnapshot(campaignId);
    if (snapshot === undefined) {
      throw new ApplicationError(
        "RESOURCE_NOT_FOUND",
        "Die angeforderte Kampagne wurde nicht gefunden.",
        { retryable: false },
      );
    }

    const balancing = await this.balancingLoader.load();
    const issues = validateCampaignLoad(snapshot.campaign, {
      balancingVersion: balancing.balancingVersion,
      catalogVersion: balancing.catalogVersion,
      hash: balancing.hash,
    });
    if (issues.length > 0) {
      throw new ApplicationError(
        "CAMPAIGN_INCOMPATIBLE",
        "Der gespeicherte Kampagnenstand ist mit der geladenen Balancingversion nicht kompatibel.",
        {
          retryable: false,
          details: issues.map((issue) => ({ field: "balancing", reason: issue.kind })),
        },
      );
    }

    assertSnapshotConsistency(snapshot);
    return snapshot;
  }
}

/**
 * Referentielle Grundkonsistenz des geladenen Aggregats: alle Teile nennen dieselbe
 * Kampagne, Kolonie und dasselbe Reich. Verletzungen deuten auf beschädigte Daten.
 */
function assertSnapshotConsistency(snapshot: CampaignSnapshot): void {
  const { campaign, empire, controller, planet, colony, populationGroup, essentialSupplyStock } =
    snapshot;
  const problems: string[] = [];
  if (empire.campaignId !== campaign.id) problems.push("empire_campaign");
  if (controller.empireId !== empire.id) problems.push("controller_empire");
  if (planet.campaignId !== campaign.id || planet.ownerEmpireId !== empire.id) {
    problems.push("planet_owner");
  }
  if (colony.campaignId !== campaign.id || colony.empireId !== empire.id) {
    problems.push("colony_owner");
  }
  if (colony.planetId !== planet.id) problems.push("colony_planet");
  if (populationGroup.campaignId !== campaign.id || populationGroup.colonyId !== colony.id) {
    problems.push("population_colony");
  }
  if (
    essentialSupplyStock.campaignId !== campaign.id ||
    essentialSupplyStock.colonyId !== colony.id
  ) {
    problems.push("stock_colony");
  }

  if (problems.length > 0) {
    throw new ApplicationError(
      "CAMPAIGN_INCOMPATIBLE",
      "Der gespeicherte Kampagnenstand ist referentiell inkonsistent.",
      {
        retryable: false,
        details: problems.map((problem) => ({ field: "snapshot", reason: problem })),
      },
    );
  }
}

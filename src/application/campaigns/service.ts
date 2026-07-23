// Feature: GAL-CAMPAIGN-CREATE-001, GAL-GALAXY-GENERATE-001, GAL-COLONY-HOME-001, GAL-POP-START-001
// Fachliche Grundlage: docs/docs/11-campaign/kampagnenstruktur.md, docs/docs/02-galaxy/galaxiestruktur-und-generierung.md
// Fachliche Grundlage: docs/docs/04-planets/planeten-und-kolonien.md, docs/docs/05-population/bevoelkerung-und-arbeit.md
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.md

import { ApplicationError } from "../errors.js";
import type { BalancingLoader, LoadedBalancingConfiguration } from "../balancing/loader.js";
import { buildStartBaseline, type StartBaseline } from "../population/start-baseline.js";
import type { WallClock } from "../runtime/clock.js";
import type { IdGenerator } from "../runtime/ids.js";
import {
  GALAXY_GENERATOR_VERSION,
  SMALL_GALAXY_PROFILE,
  type GalaxyPlanet,
} from "../../domain/galaxy/galaxy.js";
import type { GalaxyGenerator, GalaxyGenerationReport } from "../galaxy/ports.js";
import {
  assertCampaignCreationValues,
  campaignCreationFingerprint,
  type Campaign,
} from "../../domain/campaigns/campaign.js";
import {
  assertEmpireCreationValues,
  homeEmpireKnowledge,
  type Empire,
  type EmpireController,
} from "../../domain/empires/empire.js";
import {
  assertHomeColonyConsistency,
  assertHomeColonyStartState,
  assertHomeColonyValues,
  type Colony,
  type HomePlanet,
} from "../../domain/colonies/colony.js";
import type { CampaignRepository } from "./ports.js";

const START_EMPIRE_NAME = "Startreich";

export interface CreateCampaignRequest {
  readonly accountId: string;
  readonly seed: number;
  readonly timeProfile: string;
  readonly idempotencyKey: string;
}

export interface CampaignResponse {
  readonly campaignId: string;
  readonly type: "singleplayer";
  readonly status: "running";
  readonly seed: number;
  readonly timeProfile: string;
  readonly balancingVersion: string;
  readonly catalogVersion: string;
  readonly balancingHash: string;
  readonly stateVersion: number;
  readonly createdAt: string;
}

export interface CampaignServiceDependencies {
  readonly repository: CampaignRepository;
  readonly balancingLoader: BalancingLoader;
  readonly idGenerator: IdGenerator;
  readonly wallClock: WallClock;
  readonly galaxyGenerator: GalaxyGenerator;
}

function invalidCreation(details: readonly { field: string; reason: string }[]): ApplicationError {
  return new ApplicationError("INVALID_CAMPAIGN", "Die Kampagne konnte nicht angelegt werden.", {
    details,
    retryable: false,
  });
}

function findHomePlanet(galaxy: GalaxyGenerationReport): GalaxyPlanet | undefined {
  for (const system of galaxy.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.id === galaxy.homePlanetId && planet.systemId === galaxy.homeSystemId) {
        return planet;
      }
    }
  }
  return undefined;
}

function toResponse(campaign: Campaign): CampaignResponse {
  return {
    campaignId: campaign.id,
    type: campaign.type,
    status: campaign.status,
    seed: campaign.seed,
    timeProfile: campaign.timeProfile,
    balancingVersion: campaign.balancingVersion,
    catalogVersion: campaign.catalogVersion,
    balancingHash: campaign.balancingHash,
    stateVersion: campaign.stateVersion,
    createdAt: new Date(campaign.createdAt).toISOString(),
  };
}

export class CampaignService {
  private readonly repository: CampaignRepository;
  private readonly balancingLoader: BalancingLoader;
  private readonly idGenerator: IdGenerator;
  private readonly wallClock: WallClock;
  private readonly galaxyGenerator: GalaxyGenerator;

  public constructor(dependencies: CampaignServiceDependencies) {
    this.repository = dependencies.repository;
    this.balancingLoader = dependencies.balancingLoader;
    this.idGenerator = dependencies.idGenerator;
    this.wallClock = dependencies.wallClock;
    this.galaxyGenerator = dependencies.galaxyGenerator;
  }

  public async create(request: CreateCampaignRequest): Promise<CampaignResponse> {
    try {
      assertCampaignCreationValues(request);
    } catch (error) {
      const message = error instanceof RangeError ? error.message : "invalid campaign values";
      throw invalidCreation([{ field: "campaign", reason: message }]);
    }

    const balancing = await this.balancingLoader.load();
    let galaxy: GalaxyGenerationReport;
    try {
      galaxy = this.galaxyGenerator.generate({
        seed: request.seed,
        generatorVersion: GALAXY_GENERATOR_VERSION,
        profile: SMALL_GALAXY_PROFILE,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "galaxy generation failed";
      throw invalidCreation([{ field: "galaxy", reason }]);
    }
    const campaignId = this.idGenerator.next("cmp");
    const campaign: Campaign = {
      id: campaignId,
      ownerAccountId: request.accountId,
      type: "singleplayer",
      status: "running",
      seed: request.seed,
      timeProfile: request.timeProfile.trim(),
      balancingVersion: balancing.balancingVersion,
      catalogVersion: balancing.catalogVersion,
      balancingHash: balancing.hash,
      stateVersion: 1,
      campaignTimeMs: 0,
      createdAt: this.wallClock.now(),
      idempotencyKey: request.idempotencyKey.trim(),
      creationFingerprint: campaignCreationFingerprint(request.seed, request.timeProfile.trim()),
    };

    try {
      assertEmpireCreationValues({
        campaignId,
        ownerAccountId: request.accountId,
        name: START_EMPIRE_NAME,
      });
    } catch (error) {
      const message = error instanceof RangeError ? error.message : "invalid empire values";
      throw invalidCreation([{ field: "empire", reason: message }]);
    }
    const empireId = this.idGenerator.next("emp");
    const { planet, colony } = this.buildHomeColony(campaignId, empireId, galaxy);
    const baseline = this.buildStartBaseline(balancing, campaignId, colony.id);
    const empire: Empire = {
      id: empireId,
      campaignId,
      name: START_EMPIRE_NAME,
      status: "aktiv",
      // Wissen nennt genau den besessenen Heimatplaneten, nicht die interne Galaxie-ID.
      knowledge: homeEmpireKnowledge(colony.systemId, colony.planetId),
    };
    const controller: EmpireController = {
      empireId,
      accountId: request.accountId,
      controllerType: "player",
      canRead: true,
      canControl: true,
    };

    const result = await this.repository.create({
      campaign,
      empire,
      controller,
      planet,
      colony,
      populationGroup: baseline.populationGroup,
      essentialSupplyStock: baseline.essentialSupplyStock,
    });
    if (result.kind === "conflict") {
      throw new ApplicationError(
        "CAMPAIGN_CREATE_CONFLICT",
        "Der Idempotenzschlüssel wurde bereits mit anderen Kampagnendaten verwendet.",
        { retryable: false },
      );
    }
    return toResponse(result.campaign);
  }

  /**
   * Baut den Heimatplaneten und genau eine aktive, neutrale Heimatkolonie aus der
   * deterministisch generierten Galaxie. Fehlt der Heimatplanet oder ist der
   * Startzustand inkonsistent, wird die Kampagne vor jeder Persistenz abgelehnt.
   */
  private buildHomeColony(
    campaignId: string,
    empireId: string,
    galaxy: GalaxyGenerationReport,
  ): { readonly planet: HomePlanet; readonly colony: Colony } {
    const homePlanet = findHomePlanet(galaxy);
    if (homePlanet === undefined) {
      throw invalidCreation([{ field: "colony", reason: "generated galaxy has no home planet" }]);
    }

    const planetId = this.idGenerator.next("pln");
    const colonyId = this.idGenerator.next("col");
    const planet: HomePlanet = {
      id: planetId,
      systemId: galaxy.homeSystemId,
      campaignId,
      ownerEmpireId: empireId,
      category: homePlanet.category,
      size: homePlanet.size,
    };
    const colony: Colony = {
      id: colonyId,
      campaignId,
      empireId,
      planetId,
      systemId: galaxy.homeSystemId,
      isHomeColony: true,
      lifecycleState: "etabliert",
      specialization: "neutral",
    };

    try {
      assertHomeColonyValues(colony);
      assertHomeColonyStartState(colony);
      assertHomeColonyConsistency(colony, planet);
    } catch (error) {
      const reason = error instanceof RangeError ? error.message : "invalid home colony";
      throw invalidCreation([{ field: "colony", reason }]);
    }

    return { planet, colony };
  }

  /**
   * Leitet die Startbaseline für Bevölkerung und Grundversorgung ausschließlich aus den
   * versionierten Balancingwerten ab. Fehlen Werte oder verletzen sie eine Erhaltungs-
   * oder Einheitenregel, wird die Kampagne vor jeder Persistenz abgelehnt.
   */
  private buildStartBaseline(
    balancing: LoadedBalancingConfiguration,
    campaignId: string,
    colonyId: string,
  ): StartBaseline {
    try {
      return buildStartBaseline(balancing, { campaignId, colonyId }, this.idGenerator);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "invalid start baseline";
      throw invalidCreation([{ field: "population", reason }]);
    }
  }

  public async list(accountId: string): Promise<readonly CampaignResponse[]> {
    if (accountId.length === 0)
      throw new ApplicationError("UNAUTHORIZED", "Keine gültige Session.");
    return (await this.repository.listForAccount(accountId)).map(toResponse);
  }

  public async get(accountId: string, campaignId: string): Promise<CampaignResponse> {
    if (accountId.length === 0)
      throw new ApplicationError("UNAUTHORIZED", "Keine gültige Session.");
    const campaign = await this.repository.findForAccount(accountId, campaignId);
    if (campaign === undefined) {
      throw new ApplicationError(
        "CAMPAIGN_NOT_FOUND",
        "Die angeforderte Kampagne wurde nicht gefunden.",
        { retryable: false },
      );
    }
    return toResponse(campaign);
  }
}

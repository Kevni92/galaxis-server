// Feature: GAL-API-A1-STATE-001
// Fachliche Grundlage: docs/contracts/rest-api/galaxis-rest-v1.md
// Fachliche Grundlage: docs/docs/02-galaxy/erkundung-und-informationsstaende.md

import { ApplicationError } from "../errors.js";
import type { CampaignRepository } from "../campaigns/ports.js";
import type { ColonyRepository } from "../colonies/ports.js";
import type { EmpireRepository, EmpireWithController } from "../empires/ports.js";
import type { GalaxyGenerator } from "../galaxy/ports.js";
import {
  GALAXY_GENERATOR_VERSION,
  SMALL_GALAXY_PROFILE,
  type Galaxy,
  type GalaxyConnection,
  type GalaxySystem,
} from "../../domain/galaxy/galaxy.js";
import type { Campaign } from "../../domain/campaigns/campaign.js";

export interface CampaignStateResponse {
  readonly campaignId: string;
  readonly status: "running";
  readonly timeProfile: string;
  readonly campaignTimeMs: number;
  readonly stateVersion: number;
  readonly balancingVersion: string;
  readonly balancingHash: string;
  readonly controlledEmpire: {
    readonly empireId: string;
    readonly name: string;
    readonly canControl: boolean;
  };
  readonly links: Readonly<Record<string, string>>;
}

export interface GalaxyOverviewResponse {
  readonly campaignId: string;
  readonly stateVersion: number;
  readonly startSystemId: string;
  readonly knownSystems: readonly {
    readonly systemId: string;
    readonly regionId: string;
    readonly starCount: number;
    readonly planetCount: number;
    readonly links: Readonly<Record<string, string>>;
  }[];
  readonly knownConnections: readonly {
    readonly connectionId: string;
    readonly fromSystemId: string;
    readonly toSystemId: string;
    readonly distance: number;
  }[];
}

export interface SystemDetailResponse {
  readonly campaignId: string;
  readonly stateVersion: number;
  readonly systemId: string;
  readonly regionId: string;
  readonly stars: readonly { readonly starId: string; readonly starClass: string }[];
  readonly planets: readonly {
    readonly planetId: string;
    readonly category: string;
    readonly size: string;
    readonly homeworldEligible: boolean;
  }[];
}

export interface ColonyOverviewResponse {
  readonly campaignId: string;
  readonly empireId: string;
  readonly stateVersion: number;
  readonly colonies: readonly {
    readonly colonyId: string;
    readonly systemId: string;
    readonly planetId: string;
    readonly isHomeColony: boolean;
    readonly lifecycleState: string;
    readonly specialization: string;
    readonly planet: {
      readonly category: string;
      readonly size: string;
    };
    readonly links: Readonly<Record<string, string>>;
  }[];
}

export interface StateQueryServiceDependencies {
  readonly campaignRepository: CampaignRepository;
  readonly empireRepository: EmpireRepository;
  readonly colonyRepository: ColonyRepository;
  readonly galaxyGenerator: GalaxyGenerator;
}

function notFound(): ApplicationError {
  return new ApplicationError(
    "RESOURCE_NOT_FOUND",
    "Die angeforderte Ressource wurde nicht gefunden.",
    { retryable: false },
  );
}

function base(campaignId: string): string {
  return `/api/v1/campaigns/${campaignId}`;
}

/**
 * Liefert die reichsspezifischen A1-Lesezustände: Kampagnenübersicht, bekannte Galaxie,
 * Systemdetail und Kolonieübersicht. Jede Antwort ist nach Session, Kampagnenzugriff und
 * Reichswissen gefiltert; unbekannte Systeme bleiben verborgen (siehe REST-Vertrag).
 */
export class StateQueryService {
  private readonly campaignRepository: CampaignRepository;
  private readonly empireRepository: EmpireRepository;
  private readonly colonyRepository: ColonyRepository;
  private readonly galaxyGenerator: GalaxyGenerator;

  public constructor(dependencies: StateQueryServiceDependencies) {
    this.campaignRepository = dependencies.campaignRepository;
    this.empireRepository = dependencies.empireRepository;
    this.colonyRepository = dependencies.colonyRepository;
    this.galaxyGenerator = dependencies.galaxyGenerator;
  }

  public async getCampaignState(
    accountId: string,
    campaignId: string,
  ): Promise<CampaignStateResponse> {
    const campaign = await this.readableCampaign(accountId, campaignId);
    const empire = await this.controlledEmpire(accountId, campaignId);
    const empireBase = `${base(campaignId)}/empires/${empire.empire.id}`;
    return {
      campaignId: campaign.id,
      status: campaign.status,
      timeProfile: campaign.timeProfile,
      campaignTimeMs: campaign.campaignTimeMs,
      stateVersion: campaign.stateVersion,
      balancingVersion: campaign.balancingVersion,
      balancingHash: campaign.balancingHash,
      controlledEmpire: {
        empireId: empire.empire.id,
        name: empire.empire.name,
        canControl: empire.controller.canControl,
      },
      links: {
        self: `${base(campaignId)}/state`,
        galaxy: `${base(campaignId)}/galaxy`,
        colonies: `${empireBase}/colonies`,
        population: `${empireBase}/population`,
        economy: `${empireBase}/economy`,
      },
    };
  }

  public async getGalaxyOverview(
    accountId: string,
    campaignId: string,
  ): Promise<GalaxyOverviewResponse> {
    const campaign = await this.readableCampaign(accountId, campaignId);
    const empire = await this.controlledEmpire(accountId, campaignId);
    const galaxy = this.regenerateGalaxy(campaign);
    const known = new Set(empire.empire.knowledge.knownSystemIds);

    const knownSystems = galaxy.systems
      .filter((system) => known.has(system.id))
      .map((system) => ({
        systemId: system.id,
        regionId: system.regionId,
        starCount: system.stars.length,
        planetCount: system.planets.length,
        links: { self: `${base(campaignId)}/systems/${system.id}` },
      }));
    // Eine Verbindung ist nur sichtbar, wenn beide Endpunkte bekannt sind.
    const knownConnections = galaxy.connections
      .filter(
        (connection) => known.has(connection.fromSystemId) && known.has(connection.toSystemId),
      )
      .map((connection: GalaxyConnection) => ({
        connectionId: connection.id,
        fromSystemId: connection.fromSystemId,
        toSystemId: connection.toSystemId,
        distance: connection.distance,
      }));

    return {
      campaignId,
      stateVersion: campaign.stateVersion,
      startSystemId: galaxy.startSystemId,
      knownSystems,
      knownConnections,
    };
  }

  public async getSystemDetail(
    accountId: string,
    campaignId: string,
    systemId: string,
  ): Promise<SystemDetailResponse> {
    const campaign = await this.readableCampaign(accountId, campaignId);
    const empire = await this.controlledEmpire(accountId, campaignId);
    // Unbekannte oder nicht existierende Systeme sind ununterscheidbar (kein Informationsleck).
    if (!empire.empire.knowledge.knownSystemIds.includes(systemId)) {
      throw notFound();
    }
    const galaxy = this.regenerateGalaxy(campaign);
    const system = galaxy.systems.find((candidate: GalaxySystem) => candidate.id === systemId);
    if (system === undefined) throw notFound();

    return {
      campaignId,
      stateVersion: campaign.stateVersion,
      systemId: system.id,
      regionId: system.regionId,
      stars: system.stars.map((star) => ({ starId: star.id, starClass: star.starClass })),
      planets: system.planets.map((planet) => ({
        planetId: planet.id,
        category: planet.category,
        size: planet.size,
        homeworldEligible: planet.homeworldEligible,
      })),
    };
  }

  public async getColonyOverview(
    accountId: string,
    campaignId: string,
    empireId: string,
  ): Promise<ColonyOverviewResponse> {
    const campaign = await this.readableCampaign(accountId, campaignId);
    const empire = await this.readableEmpire(accountId, campaignId, empireId);
    const home = await this.colonyRepository.findHomeColonyForEmpire(campaignId, empire.empire.id);
    const colonies =
      home === undefined
        ? []
        : [
            {
              colonyId: home.colony.id,
              systemId: home.colony.systemId,
              planetId: home.colony.planetId,
              isHomeColony: home.colony.isHomeColony,
              lifecycleState: home.colony.lifecycleState,
              specialization: home.colony.specialization,
              planet: { category: home.planet.category, size: home.planet.size },
              links: {
                system: `${base(campaignId)}/systems/${home.colony.systemId}`,
                population: `${base(campaignId)}/empires/${empire.empire.id}/population`,
                economy: `${base(campaignId)}/empires/${empire.empire.id}/economy`,
              },
            },
          ];

    return {
      campaignId,
      empireId: empire.empire.id,
      stateVersion: campaign.stateVersion,
      colonies,
    };
  }

  private regenerateGalaxy(campaign: Campaign): Galaxy {
    // Deterministische Rekonstruktion aus dem Kampagnenseed; keine Galaxiepersistenz in A1.
    return this.galaxyGenerator.generate({
      seed: campaign.seed,
      generatorVersion: GALAXY_GENERATOR_VERSION,
      profile: SMALL_GALAXY_PROFILE,
    }).galaxy;
  }

  private async readableCampaign(accountId: string, campaignId: string): Promise<Campaign> {
    if (accountId.length === 0) {
      throw new ApplicationError("UNAUTHORIZED", "Keine gültige Session.");
    }
    const campaign = await this.campaignRepository.findForAccount(accountId, campaignId);
    if (campaign === undefined) throw notFound();
    return campaign;
  }

  private async controlledEmpire(
    accountId: string,
    campaignId: string,
  ): Promise<EmpireWithController> {
    const empires = await this.empireRepository.listReadableForAccount(accountId, campaignId);
    const empire = empires[0];
    if (empire === undefined) throw notFound();
    return empire;
  }

  private async readableEmpire(
    accountId: string,
    campaignId: string,
    empireId: string,
  ): Promise<EmpireWithController> {
    const empire = await this.empireRepository.findReadableForAccount(accountId, empireId);
    if (empire === undefined || empire.empire.campaignId !== campaignId) throw notFound();
    return empire;
  }
}

// Feature: GAL-CAMPAIGN-CREATE-001, GAL-GALAXY-GENERATE-001
// Fachliche Grundlage: docs/docs/11-campaign/kampagnenstruktur.md, docs/docs/02-galaxy/galaxiestruktur-und-generierung.md
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.md

import { ApplicationError } from "../errors.js";
import type { BalancingLoader } from "../balancing/loader.js";
import type { WallClock } from "../runtime/clock.js";
import type { IdGenerator } from "../runtime/ids.js";
import { GALAXY_GENERATOR_VERSION, SMALL_GALAXY_PROFILE } from "../../domain/galaxy/galaxy.js";
import type { GalaxyGenerator } from "../galaxy/ports.js";
import {
  assertCampaignCreationValues,
  campaignCreationFingerprint,
  type Campaign,
} from "../../domain/campaigns/campaign.js";
import {
  assertEmpireCreationValues,
  emptyEmpireKnowledge,
  type Empire,
  type EmpireController,
} from "../../domain/empires/empire.js";
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
    try {
      this.galaxyGenerator.generate({
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
    const empire: Empire = {
      id: empireId,
      campaignId,
      name: START_EMPIRE_NAME,
      status: "aktiv",
      knowledge: emptyEmpireKnowledge(),
    };
    const controller: EmpireController = {
      empireId,
      accountId: request.accountId,
      controllerType: "player",
      canRead: true,
      canControl: true,
    };

    const result = await this.repository.create({ campaign, empire, controller });
    if (result.kind === "conflict") {
      throw new ApplicationError(
        "CAMPAIGN_CREATE_CONFLICT",
        "Der Idempotenzschlüssel wurde bereits mit anderen Kampagnendaten verwendet.",
        { retryable: false },
      );
    }
    return toResponse(result.campaign);
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

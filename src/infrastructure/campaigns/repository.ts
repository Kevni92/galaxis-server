// Feature: GAL-CAMPAIGN-CREATE-001, GAL-EMPIRE-START-001, GAL-COLONY-HOME-001
// Fachliche Grundlage: docs/docs/11-campaign/kampagnenstruktur.md
// Fachliche Grundlage: docs/docs/03-empires/reichsverwaltung.md
// Fachliche Grundlage: docs/docs/04-planets/planeten-und-kolonien.md
// Architekturentscheidung: docs/decisions/0001-asynchrones-kampagnen-und-controller-grundmodell.md

import type { Kysely } from "kysely";

import type {
  CampaignCreation,
  CampaignCreateResult,
  CampaignRepository,
} from "../../application/campaigns/ports.js";
import type { Campaign } from "../../domain/campaigns/campaign.js";
import type { Empire, EmpireController } from "../../domain/empires/empire.js";
import type { Colony, HomePlanet } from "../../domain/colonies/colony.js";
import type { CampaignTable, DatabaseSchema } from "../database/database.js";

export class KyselyCampaignRepository implements CampaignRepository {
  private readonly database: Kysely<DatabaseSchema>;

  public constructor(database: Kysely<DatabaseSchema>) {
    this.database = database;
  }

  public async create(creation: CampaignCreation): Promise<CampaignCreateResult> {
    const { campaign, empire, controller, planet, colony } = creation;
    return this.database.transaction().execute(async (transaction) => {
      const inserted = await transaction
        .insertInto("campaigns")
        .values(toCampaignRow(campaign))
        .onConflict((conflict) =>
          conflict.columns(["owner_account_id", "idempotency_key"]).doNothing(),
        )
        .returning("campaign_id")
        .executeTakeFirst();

      if (inserted !== undefined) {
        await transaction
          .insertInto("campaign_participants")
          .values({
            campaign_id: campaign.id,
            account_id: campaign.ownerAccountId,
            participant_role: "owner",
            can_read: true,
            can_control: true,
            joined_at: new Date(campaign.createdAt),
          })
          .execute();
        await transaction.insertInto("empires").values(toEmpireRow(empire)).execute();
        await transaction
          .insertInto("empire_controllers")
          .values(toControllerRow(controller))
          .execute();
        await transaction.insertInto("planets").values(toPlanetRow(planet)).execute();
        await transaction.insertInto("colonies").values(toColonyRow(colony)).execute();
        return { kind: "created", campaign };
      }

      const existing = await transaction
        .selectFrom("campaigns")
        .selectAll()
        .where("owner_account_id", "=", campaign.ownerAccountId)
        .where("idempotency_key", "=", campaign.idempotencyKey)
        .executeTakeFirst();
      if (existing === undefined) {
        throw new Error("Campaign idempotency record disappeared during creation");
      }
      if (existing.creation_fingerprint !== campaign.creationFingerprint) {
        return { kind: "conflict" };
      }
      return { kind: "existing", campaign: fromCampaignRow(existing) };
    });
  }

  public async listForAccount(accountId: string): Promise<readonly Campaign[]> {
    const rows = await this.database
      .selectFrom("campaigns")
      .innerJoin(
        "campaign_participants",
        "campaign_participants.campaign_id",
        "campaigns.campaign_id",
      )
      .selectAll("campaigns")
      .where("campaign_participants.account_id", "=", accountId)
      .where("campaign_participants.can_read", "=", true)
      .orderBy("campaigns.created_at", "desc")
      .orderBy("campaigns.campaign_id", "desc")
      .execute();
    return rows.map(fromCampaignRow);
  }

  public async findForAccount(
    accountId: string,
    campaignId: string,
  ): Promise<Campaign | undefined> {
    const row = await this.database
      .selectFrom("campaigns")
      .innerJoin(
        "campaign_participants",
        "campaign_participants.campaign_id",
        "campaigns.campaign_id",
      )
      .selectAll("campaigns")
      .where("campaigns.campaign_id", "=", campaignId)
      .where("campaign_participants.account_id", "=", accountId)
      .where("campaign_participants.can_read", "=", true)
      .executeTakeFirst();
    return row === undefined ? undefined : fromCampaignRow(row);
  }
}

type CampaignRow = Omit<CampaignTable, "id"> & { readonly id: number };

function toCampaignRow(campaign: Campaign): Omit<CampaignTable, "id"> {
  return {
    campaign_id: campaign.id,
    owner_account_id: campaign.ownerAccountId,
    campaign_type: campaign.type,
    status: campaign.status,
    seed: campaign.seed,
    time_profile: campaign.timeProfile,
    balancing_version: campaign.balancingVersion,
    catalog_version: campaign.catalogVersion,
    balancing_hash: campaign.balancingHash,
    state_version: campaign.stateVersion,
    campaign_time_ms: campaign.campaignTimeMs,
    idempotency_key: campaign.idempotencyKey,
    creation_fingerprint: campaign.creationFingerprint,
    created_at: new Date(campaign.createdAt),
  };
}

function toEmpireRow(empire: Empire): {
  empire_id: string;
  campaign_id: string;
  name: string;
  status: Empire["status"];
  known_system_ids: string;
  known_planet_ids: string;
} {
  return {
    empire_id: empire.id,
    campaign_id: empire.campaignId,
    name: empire.name,
    status: empire.status,
    known_system_ids: JSON.stringify([...empire.knowledge.knownSystemIds]),
    known_planet_ids: JSON.stringify([...empire.knowledge.knownPlanetIds]),
  };
}

function toControllerRow(controller: EmpireController): {
  empire_id: string;
  account_id: string;
  controller_type: EmpireController["controllerType"];
  can_read: boolean;
  can_control: boolean;
} {
  return {
    empire_id: controller.empireId,
    account_id: controller.accountId,
    controller_type: controller.controllerType,
    can_read: controller.canRead,
    can_control: controller.canControl,
  };
}

function toPlanetRow(planet: HomePlanet): {
  planet_id: string;
  campaign_id: string;
  system_id: string;
  owner_empire_id: string;
  category: HomePlanet["category"];
  size: HomePlanet["size"];
} {
  return {
    planet_id: planet.id,
    campaign_id: planet.campaignId,
    system_id: planet.systemId,
    owner_empire_id: planet.ownerEmpireId,
    category: planet.category,
    size: planet.size,
  };
}

function toColonyRow(colony: Colony): {
  colony_id: string;
  campaign_id: string;
  empire_id: string;
  planet_id: string;
  system_id: string;
  is_home_colony: boolean;
  lifecycle_state: Colony["lifecycleState"];
  specialization: Colony["specialization"];
} {
  return {
    colony_id: colony.id,
    campaign_id: colony.campaignId,
    empire_id: colony.empireId,
    planet_id: colony.planetId,
    system_id: colony.systemId,
    is_home_colony: colony.isHomeColony,
    lifecycle_state: colony.lifecycleState,
    specialization: colony.specialization,
  };
}

function fromCampaignRow(row: CampaignRow): Campaign {
  return {
    id: row.campaign_id,
    ownerAccountId: row.owner_account_id,
    type: row.campaign_type,
    status: row.status,
    seed: Number(row.seed),
    timeProfile: row.time_profile,
    balancingVersion: row.balancing_version,
    catalogVersion: row.catalog_version,
    balancingHash: row.balancing_hash,
    stateVersion: Number(row.state_version),
    campaignTimeMs: Number(row.campaign_time_ms),
    idempotencyKey: row.idempotency_key,
    creationFingerprint: row.creation_fingerprint,
    createdAt: row.created_at.getTime(),
  };
}

// Feature: GAL-PERSIST-A1-001
// Fachliche Grundlage: docs/decisions/0004-versionierte-balancing-schicht.md
// Fachliche Grundlage: docs/TESTING.md

import { sql, type Kysely, type Selectable } from "kysely";

import type {
  CampaignSnapshot,
  CampaignStateStore,
  StateChangeResult,
} from "../../application/campaigns/state-store.js";
import type { Campaign } from "../../domain/campaigns/campaign.js";
import type { Empire, EmpireController } from "../../domain/empires/empire.js";
import type { Colony, HomePlanet } from "../../domain/colonies/colony.js";
import type {
  EssentialSupplyStock,
  PopulationGroup,
} from "../../domain/population/start-baseline.js";
import type {
  CampaignTable,
  ColonyStockTable,
  ColonyTable,
  DatabaseSchema,
  EmpireControllerTable,
  EmpireTable,
  PlanetTable,
  PopulationGroupTable,
} from "../database/database.js";

/**
 * Serverautoritative Zustandsführung einer Kampagne. Änderungen laufen in einer
 * Transaktion; die Versionserhöhung ist ein Compare-and-Swap auf `state_version`.
 */
export class KyselyCampaignStateStore implements CampaignStateStore {
  private readonly database: Kysely<DatabaseSchema>;

  public constructor(database: Kysely<DatabaseSchema>) {
    this.database = database;
  }

  public async applyStateChange(
    campaignId: string,
    expectedStateVersion: number,
  ): Promise<StateChangeResult> {
    return this.database.transaction().execute(async (transaction) => {
      // Bedingtes UPDATE: nur wenn die erwartete Version noch aktuell ist.
      const updated = await transaction
        .updateTable("campaigns")
        .set({ state_version: sql<number>`state_version + 1` })
        .where("campaign_id", "=", campaignId)
        .where("state_version", "=", expectedStateVersion)
        .returning("state_version")
        .executeTakeFirst();
      if (updated !== undefined) {
        return { kind: "applied", stateVersion: Number(updated.state_version) };
      }

      const current = await transaction
        .selectFrom("campaigns")
        .select("state_version")
        .where("campaign_id", "=", campaignId)
        .executeTakeFirst();
      if (current === undefined) return { kind: "not_found" };
      return { kind: "conflict", currentStateVersion: Number(current.state_version) };
    });
  }

  public async loadSnapshot(campaignId: string): Promise<CampaignSnapshot | undefined> {
    const campaignRow = await this.database
      .selectFrom("campaigns")
      .selectAll()
      .where("campaign_id", "=", campaignId)
      .executeTakeFirst();
    if (campaignRow === undefined) return undefined;

    const empireRow = await this.database
      .selectFrom("empires")
      .selectAll()
      .where("campaign_id", "=", campaignId)
      .executeTakeFirst();
    if (empireRow === undefined) return undefined;

    const controllerRow = await this.database
      .selectFrom("empire_controllers")
      .selectAll()
      .where("empire_id", "=", empireRow.empire_id)
      .executeTakeFirst();
    if (controllerRow === undefined) return undefined;

    const colonyRow = await this.database
      .selectFrom("colonies")
      .selectAll()
      .where("campaign_id", "=", campaignId)
      .where("empire_id", "=", empireRow.empire_id)
      .where("is_home_colony", "=", true)
      .executeTakeFirst();
    if (colonyRow === undefined) return undefined;

    const planetRow = await this.database
      .selectFrom("planets")
      .selectAll()
      .where("planet_id", "=", colonyRow.planet_id)
      .executeTakeFirst();
    if (planetRow === undefined) return undefined;

    const populationRow = await this.database
      .selectFrom("population_groups")
      .selectAll()
      .where("campaign_id", "=", campaignId)
      .where("colony_id", "=", colonyRow.colony_id)
      .executeTakeFirst();
    if (populationRow === undefined) return undefined;

    const stockRow = await this.database
      .selectFrom("colony_stocks")
      .selectAll()
      .where("campaign_id", "=", campaignId)
      .where("colony_id", "=", colonyRow.colony_id)
      .where("resource_category", "=", "essential")
      .executeTakeFirst();
    if (stockRow === undefined) return undefined;

    return {
      campaign: fromCampaignRow(campaignRow),
      empire: fromEmpireRow(empireRow),
      controller: fromControllerRow(controllerRow),
      planet: fromPlanetRow(planetRow),
      colony: fromColonyRow(colonyRow),
      populationGroup: fromPopulationRow(populationRow),
      essentialSupplyStock: fromStockRow(stockRow),
    };
  }
}

function fromCampaignRow(row: Selectable<CampaignTable>): Campaign {
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

function fromEmpireRow(row: Selectable<EmpireTable>): Empire {
  return {
    id: row.empire_id,
    campaignId: row.campaign_id,
    name: row.name,
    status: row.status,
    knowledge: {
      knownSystemIds: [...row.known_system_ids],
      knownPlanetIds: [...row.known_planet_ids],
    },
  };
}

function fromControllerRow(row: Selectable<EmpireControllerTable>): EmpireController {
  return {
    empireId: row.empire_id,
    accountId: row.account_id,
    controllerType: row.controller_type,
    canRead: row.can_read,
    canControl: row.can_control,
  };
}

function fromPlanetRow(row: Selectable<PlanetTable>): HomePlanet {
  return {
    id: row.planet_id,
    systemId: row.system_id,
    campaignId: row.campaign_id,
    ownerEmpireId: row.owner_empire_id,
    category: row.category,
    size: row.size,
  };
}

function fromColonyRow(row: Selectable<ColonyTable>): Colony {
  return {
    id: row.colony_id,
    campaignId: row.campaign_id,
    empireId: row.empire_id,
    planetId: row.planet_id,
    systemId: row.system_id,
    isHomeColony: row.is_home_colony,
    lifecycleState: row.lifecycle_state,
    specialization: row.specialization,
  };
}

function fromPopulationRow(row: Selectable<PopulationGroupTable>): PopulationGroup {
  return {
    id: row.population_group_id,
    campaignId: row.campaign_id,
    colonyId: row.colony_id,
    origin: row.origin,
    total: Number(row.total),
    employable: Number(row.employable),
    employed: Number(row.employed),
  };
}

function fromStockRow(row: Selectable<ColonyStockTable>): EssentialSupplyStock {
  return {
    id: row.stock_id,
    campaignId: row.campaign_id,
    colonyId: row.colony_id,
    quantity: Number(row.quantity),
    reserved: Number(row.reserved),
    coverageDays: Number(row.coverage_days),
  };
}

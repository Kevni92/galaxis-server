// Feature: GAL-COLONY-HOME-001
// Fachliche Grundlage: docs/docs/04-planets/planeten-und-kolonien.md

import type { Kysely, Selectable } from "kysely";

import type { ColonyRepository, HomeColonyView } from "../../application/colonies/ports.js";
import type { Colony, HomePlanet } from "../../domain/colonies/colony.js";
import type { ColonyTable, DatabaseSchema, PlanetTable } from "../database/database.js";

type ColonyRow = Selectable<ColonyTable>;
type PlanetRow = Selectable<PlanetTable>;

/** Lädt die persistierte Heimatkolonie unverändert, sodass ein Reload identisch bleibt. */
export class KyselyColonyRepository implements ColonyRepository {
  private readonly database: Kysely<DatabaseSchema>;

  public constructor(database: Kysely<DatabaseSchema>) {
    this.database = database;
  }

  public async findHomeColonyForEmpire(
    campaignId: string,
    empireId: string,
  ): Promise<HomeColonyView | undefined> {
    const colonyRow = await this.database
      .selectFrom("colonies")
      .selectAll()
      .where("campaign_id", "=", campaignId)
      .where("empire_id", "=", empireId)
      .where("is_home_colony", "=", true)
      .executeTakeFirst();
    if (colonyRow === undefined) return undefined;

    const planetRow = await this.database
      .selectFrom("planets")
      .selectAll()
      .where("planet_id", "=", colonyRow.planet_id)
      .executeTakeFirst();
    if (planetRow === undefined) return undefined;

    return { colony: fromColonyRow(colonyRow), planet: fromPlanetRow(planetRow) };
  }
}

function fromColonyRow(row: ColonyRow): Colony {
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

function fromPlanetRow(row: PlanetRow): HomePlanet {
  return {
    id: row.planet_id,
    systemId: row.system_id,
    campaignId: row.campaign_id,
    ownerEmpireId: row.owner_empire_id,
    category: row.category,
    size: row.size,
  };
}

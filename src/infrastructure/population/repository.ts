// Feature: GAL-POP-START-001
// Fachliche Grundlage: docs/docs/05-population/bevoelkerung-und-arbeit.md
// Fachliche Grundlage: docs/docs/06-economy/wirtschaft-und-versorgung.md

import type { Kysely, Selectable } from "kysely";

import type {
  HomeColonyBaselineView,
  StartBaselineRepository,
} from "../../application/population/ports.js";
import type {
  EssentialSupplyStock,
  PopulationGroup,
} from "../../domain/population/start-baseline.js";
import type {
  ColonyStockTable,
  DatabaseSchema,
  PopulationGroupTable,
} from "../database/database.js";

type PopulationGroupRow = Selectable<PopulationGroupTable>;
type ColonyStockRow = Selectable<ColonyStockTable>;

/** Lädt die persistierte Startbaseline unverändert, sodass ein Reload identisch bleibt. */
export class KyselyStartBaselineRepository implements StartBaselineRepository {
  private readonly database: Kysely<DatabaseSchema>;

  public constructor(database: Kysely<DatabaseSchema>) {
    this.database = database;
  }

  public async findHomeColonyBaseline(
    campaignId: string,
    empireId: string,
  ): Promise<HomeColonyBaselineView | undefined> {
    const colonyRow = await this.database
      .selectFrom("colonies")
      .innerJoin("campaigns", "campaigns.campaign_id", "colonies.campaign_id")
      .select([
        "colonies.colony_id",
        "colonies.system_id",
        "campaigns.state_version",
        "campaigns.created_at as campaign_created_at",
      ])
      .where("colonies.campaign_id", "=", campaignId)
      .where("colonies.empire_id", "=", empireId)
      .where("colonies.is_home_colony", "=", true)
      .executeTakeFirst();
    if (colonyRow === undefined) return undefined;

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
      colonyId: colonyRow.colony_id,
      systemId: colonyRow.system_id,
      stateVersion: Number(colonyRow.state_version),
      generatedAt: colonyRow.campaign_created_at.toISOString(),
      populationGroup: fromPopulationRow(populationRow),
      essentialSupplyStock: fromStockRow(stockRow),
    };
  }
}

function fromPopulationRow(row: PopulationGroupRow): PopulationGroup {
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

function fromStockRow(row: ColonyStockRow): EssentialSupplyStock {
  return {
    id: row.stock_id,
    campaignId: row.campaign_id,
    colonyId: row.colony_id,
    quantity: Number(row.quantity),
    reserved: Number(row.reserved),
    coverageDays: Number(row.coverage_days),
  };
}

// Feature: GAL-EMPIRE-START-001
// Fachliche Grundlage: docs/docs/03-empires/reichsverwaltung.md
// Fachliche Grundlage: docs/docs/03-empires/controller-und-reichsuebernahme.md

import type { Kysely, Selectable } from "kysely";

import type { EmpireRepository, EmpireWithController } from "../../application/empires/ports.js";
import type { Empire, EmpireController } from "../../domain/empires/empire.js";
import type { DatabaseSchema, EmpireControllerTable, EmpireTable } from "../database/database.js";

type EmpireRow = Selectable<EmpireTable>;

/** Liest Reiche strikt nach Controller-Lesezugriff; Befehlsrecht bleibt getrennt. */
export class KyselyEmpireRepository implements EmpireRepository {
  private readonly database: Kysely<DatabaseSchema>;

  public constructor(database: Kysely<DatabaseSchema>) {
    this.database = database;
  }

  public async listReadableForAccount(
    accountId: string,
    campaignId: string,
  ): Promise<readonly EmpireWithController[]> {
    const rows = await this.database
      .selectFrom("empires")
      .innerJoin("empire_controllers", "empire_controllers.empire_id", "empires.empire_id")
      .selectAll("empires")
      .select([
        "empire_controllers.account_id as controller_account_id",
        "empire_controllers.controller_type as controller_type",
        "empire_controllers.can_read as controller_can_read",
        "empire_controllers.can_control as controller_can_control",
      ])
      .where("empires.campaign_id", "=", campaignId)
      .where("empire_controllers.account_id", "=", accountId)
      .where("empire_controllers.can_read", "=", true)
      .orderBy("empires.empire_id", "asc")
      .execute();
    return rows.map(fromJoinedRow);
  }

  public async findReadableForAccount(
    accountId: string,
    empireId: string,
  ): Promise<EmpireWithController | undefined> {
    const row = await this.database
      .selectFrom("empires")
      .innerJoin("empire_controllers", "empire_controllers.empire_id", "empires.empire_id")
      .selectAll("empires")
      .select([
        "empire_controllers.account_id as controller_account_id",
        "empire_controllers.controller_type as controller_type",
        "empire_controllers.can_read as controller_can_read",
        "empire_controllers.can_control as controller_can_control",
      ])
      .where("empires.empire_id", "=", empireId)
      .where("empire_controllers.account_id", "=", accountId)
      .where("empire_controllers.can_read", "=", true)
      .executeTakeFirst();
    return row === undefined ? undefined : fromJoinedRow(row);
  }
}

type JoinedRow = EmpireRow & {
  readonly controller_account_id: string;
  readonly controller_type: EmpireControllerTable["controller_type"];
  readonly controller_can_read: boolean;
  readonly controller_can_control: boolean;
};

function fromJoinedRow(row: JoinedRow): EmpireWithController {
  const empire: Empire = {
    id: row.empire_id,
    campaignId: row.campaign_id,
    name: row.name,
    status: row.status,
    knowledge: {
      knownSystemIds: [...row.known_system_ids],
      knownPlanetIds: [...row.known_planet_ids],
    },
  };
  const controller: EmpireController = {
    empireId: row.empire_id,
    accountId: row.controller_account_id,
    controllerType: row.controller_type,
    canRead: row.controller_can_read,
    canControl: row.controller_can_control,
  };
  return { empire, controller };
}

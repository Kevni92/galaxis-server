// Feature: GAL-AUTH-ACCOUNT-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import type { Kysely } from "kysely";

import type { AccountRepository } from "../../application/accounts/ports.js";
import type { Account } from "../../domain/accounts/account.js";
import type { DatabaseSchema } from "../database/database.js";

export class KyselyAccountRepository implements AccountRepository {
  private readonly database: Kysely<DatabaseSchema>;

  public constructor(database: Kysely<DatabaseSchema>) {
    this.database = database;
  }

  public async create(account: Account): Promise<boolean> {
    const inserted = await this.database
      .insertInto("accounts")
      .values({
        account_id: account.id,
        email: account.email,
        password_hash: account.passwordHash,
        created_at: new Date(account.createdAt),
      })
      .onConflict((conflict) => conflict.column("email").doNothing())
      .returning("account_id")
      .executeTakeFirst();

    return inserted !== undefined;
  }
}

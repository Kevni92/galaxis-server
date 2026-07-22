// Feature: GAL-AUTH-ACCOUNT-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import type { Kysely } from "kysely";

import type {
  AccountCredentialReader,
  AccountRepository,
} from "../../application/accounts/ports.js";
import type { Account } from "../../domain/accounts/account.js";
import type { AccountTable, DatabaseSchema } from "../database/database.js";

export class KyselyAccountRepository implements AccountRepository, AccountCredentialReader {
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

  public async findByEmail(email: string): Promise<Account | undefined> {
    const row = await this.database
      .selectFrom("accounts")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();
    return row === undefined ? undefined : toAccount(row);
  }

  public async findById(accountId: string): Promise<Account | undefined> {
    const row = await this.database
      .selectFrom("accounts")
      .selectAll()
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    return row === undefined ? undefined : toAccount(row);
  }
}

function toAccount(
  row: Pick<AccountTable, "account_id" | "email" | "password_hash" | "created_at">,
): Account {
  return {
    id: row.account_id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at.getTime(),
  };
}

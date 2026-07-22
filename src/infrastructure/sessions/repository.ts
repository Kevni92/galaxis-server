// Feature: GAL-AUTH-SESSION-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import type { Kysely } from "kysely";

import type { SessionRepository } from "../../application/sessions/ports.js";
import type { Session } from "../../domain/sessions/session.js";
import type { DatabaseSchema, SessionTable } from "../database/database.js";

export class KyselySessionRepository implements SessionRepository {
  private readonly database: Kysely<DatabaseSchema>;

  public constructor(database: Kysely<DatabaseSchema>) {
    this.database = database;
  }

  public async create(session: Session): Promise<void> {
    await this.database
      .insertInto("sessions")
      .values({
        session_id: session.id,
        account_id: session.accountId,
        token_hash: session.tokenHash,
        created_at: new Date(session.createdAt),
        expires_at: new Date(session.expiresAt),
        last_used_at: session.lastUsedAt === null ? null : new Date(session.lastUsedAt),
        revoked_at: session.revokedAt === null ? null : new Date(session.revokedAt),
      })
      .execute();
  }

  public async findActiveByTokenHash(tokenHash: string, now: number): Promise<Session | undefined> {
    const row = await this.database
      .updateTable("sessions")
      .set({ last_used_at: new Date(now) })
      .where("token_hash", "=", tokenHash)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", new Date(now))
      .returningAll()
      .executeTakeFirst();

    return row === undefined ? undefined : toSession(row);
  }

  public async revoke(sessionId: string, revokedAt: number): Promise<boolean> {
    const row = await this.database
      .updateTable("sessions")
      .set({ revoked_at: new Date(revokedAt) })
      .where("session_id", "=", sessionId)
      .where("revoked_at", "is", null)
      .returning("session_id")
      .executeTakeFirst();

    return row !== undefined;
  }
}

function toSession(
  row: Pick<
    SessionTable,
    | "session_id"
    | "account_id"
    | "token_hash"
    | "created_at"
    | "expires_at"
    | "last_used_at"
    | "revoked_at"
  >,
): Session {
  return {
    id: row.session_id,
    accountId: row.account_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at.getTime(),
    expiresAt: row.expires_at.getTime(),
    lastUsedAt: row.last_used_at?.getTime() ?? null,
    revokedAt: row.revoked_at?.getTime() ?? null,
  };
}

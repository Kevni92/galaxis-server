// Feature: GAL-PLATFORM-DB-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { RuntimeConfig } from "../config/config.js";

/** The empty schema is intentional until the first feature-owned table is introduced. */
export type DatabaseSchema = Record<string, never>;

export interface PostgresDatabase {
  readonly pool: Pool;
  readonly db: Kysely<DatabaseSchema>;
  checkHealth(): Promise<boolean>;
  close(): Promise<void>;
}

export function createPostgresDatabase(config: RuntimeConfig): PostgresDatabase {
  if (config.databaseUrl === undefined) {
    throw new Error("GALAXIS_DATABASE_URL is required to create the PostgreSQL adapter");
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    application_name: config.serviceName,
  });
  const db = new Kysely<DatabaseSchema>({ dialect: new PostgresDialect({ pool }) });
  let closePromise: Promise<void> | undefined;

  return {
    pool,
    db,
    async checkHealth(): Promise<boolean> {
      try {
        await pool.query("SELECT 1");
        return true;
      } catch {
        return false;
      }
    },
    close(): Promise<void> {
      closePromise ??= db.destroy();
      return closePromise;
    },
  };
}

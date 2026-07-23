// Feature: GAL-PLATFORM-DB-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import { Kysely, PostgresDialect, type Generated, type JSONColumnType } from "kysely";
import { Pool } from "pg";

import type { RuntimeConfig } from "../config/config.js";

export interface AccountTable {
  id: Generated<number>;
  account_id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface SessionTable {
  id: Generated<number>;
  session_id: string;
  account_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

export interface CampaignTable {
  id: Generated<number>;
  campaign_id: string;
  owner_account_id: string;
  campaign_type: "singleplayer";
  status: "running";
  seed: number;
  time_profile: string;
  balancing_version: string;
  catalog_version: string;
  balancing_hash: string;
  state_version: number;
  campaign_time_ms: number;
  idempotency_key: string;
  creation_fingerprint: string;
  created_at: Date;
}

export interface CampaignParticipantTable {
  campaign_id: string;
  account_id: string;
  participant_role: "owner";
  can_read: boolean;
  can_control: boolean;
  joined_at: Date;
}

export interface EmpireTable {
  id: Generated<number>;
  empire_id: string;
  campaign_id: string;
  name: string;
  status: "vorbereitet" | "aktiv";
  known_system_ids: JSONColumnType<string[]>;
  known_planet_ids: JSONColumnType<string[]>;
}

export interface EmpireControllerTable {
  empire_id: string;
  account_id: string;
  controller_type: "player" | "ai";
  can_read: boolean;
  can_control: boolean;
}

export interface DatabaseSchema {
  accounts: AccountTable;
  sessions: SessionTable;
  campaigns: CampaignTable;
  campaign_participants: CampaignParticipantTable;
  empires: EmpireTable;
  empire_controllers: EmpireControllerTable;
}

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

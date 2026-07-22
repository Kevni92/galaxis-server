// Feature: GAL-PLATFORM-DB-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import type { Pool, PoolClient } from "pg";

const migrationFilePattern = /^(\d+)-([a-z0-9-]+)\.sql$/u;
const schemaMigrationsTableSql = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;
const migrationLockKey = 84736291;

export interface MigrationFile {
  readonly version: number;
  readonly name: string;
  readonly filename: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface MigrationResult {
  readonly appliedVersions: readonly number[];
}

interface AppliedMigration {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

export class MigrationError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MigrationError";
  }
}

function checksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export async function loadMigrations(directory: string): Promise<readonly MigrationFile[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new MigrationError(`Cannot read migration directory '${directory}'`, { cause: error });
  }

  const migrations: MigrationFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".sql")) continue;

    const match = migrationFilePattern.exec(entry.name);
    if (match === null) {
      throw new MigrationError(
        `Migration filename '${entry.name}' must match <version>-<name>.sql`,
      );
    }

    const versionText = match[1];
    const name = match[2];
    if (versionText === undefined || name === undefined) {
      throw new MigrationError(`Migration filename '${entry.name}' contains an empty component`);
    }

    const version = Number(versionText);
    const sql = await readFile(join(directory, entry.name), "utf8");
    migrations.push({
      version,
      name,
      filename: basename(entry.name),
      sql,
      checksum: checksum(sql),
    });
  }

  migrations.sort((left, right) => left.version - right.version);
  for (let index = 1; index < migrations.length; index += 1) {
    const previous = migrations[index - 1];
    const current = migrations[index];
    if (previous === undefined || current === undefined) continue;
    if (previous.version === current.version) {
      throw new MigrationError(`Duplicate migration version ${current.version}`);
    }
  }

  return migrations;
}

async function appliedMigrations(client: PoolClient): Promise<readonly AppliedMigration[]> {
  const result = await client.query<AppliedMigration>(
    "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
  );
  return result.rows;
}

function validateAppliedMigrations(
  migrations: readonly MigrationFile[],
  applied: readonly AppliedMigration[],
): void {
  const filesByVersion = new Map(migrations.map((migration) => [migration.version, migration]));

  for (const record of applied) {
    const migration = filesByVersion.get(record.version);
    if (migration === undefined) {
      throw new MigrationError(
        `Database contains migration ${record.version}, but its SQL file is missing`,
      );
    }
    if (migration.name !== record.name || migration.checksum !== record.checksum) {
      throw new MigrationError(
        `Migration ${record.version} does not match the checksum or name stored in the database`,
      );
    }
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original migration error.
  }
}

export async function runMigrations(pool: Pool, directory: string): Promise<MigrationResult> {
  const migrations = await loadMigrations(directory);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [migrationLockKey]);
    await client.query(schemaMigrationsTableSql);

    const applied = await appliedMigrations(client);
    validateAppliedMigrations(migrations, applied);
    const appliedVersions = new Set(applied.map((migration) => migration.version));
    const newlyApplied: number[] = [];

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;

      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
          [migration.version, migration.name, migration.checksum],
        );
        newlyApplied.push(migration.version);
      } catch (error) {
        throw new MigrationError(
          `Migration ${migration.filename} failed; all changes were rolled back`,
          { cause: error },
        );
      }
    }

    await client.query("COMMIT");
    return { appliedVersions: newlyApplied };
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function checkMigrations(pool: Pool, directory: string): Promise<void> {
  const migrations = await loadMigrations(directory);
  const client = await pool.connect();

  try {
    const applied = await appliedMigrations(client);
    validateAppliedMigrations(migrations, applied);
    const appliedVersions = new Set(applied.map((migration) => migration.version));
    const pending = migrations.filter((migration) => !appliedVersions.has(migration.version));
    if (pending.length > 0) {
      throw new MigrationError(
        `Database has pending migrations: ${pending.map((migration) => migration.version).join(", ")}`,
      );
    }
  } catch (error) {
    if (isMissingSchemaMigrationsTable(error)) {
      throw new MigrationError("schema_migrations is missing; run pnpm db:migrate first", {
        cause: error,
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

function isMissingSchemaMigrationsTable(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01"
  );
}

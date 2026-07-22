import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Pool } from "pg";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

import { checkMigrations, runMigrations } from "../../src/infrastructure/database/migrations.js";

const migrationDirectory = fileURLToPath(new URL("../../migrations/", import.meta.url));

describe("PostgreSQL database foundation", () => {
  let container: StartedTestContainer | undefined;
  let connectionString: string | undefined;

  beforeAll(async () => {
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({
          POSTGRES_DB: "galaxis_test",
          POSTGRES_USER: "galaxis",
          POSTGRES_PASSWORD: "galaxis",
        })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/u))
        .withStartupTimeout(120000)
        .start();

      connectionString = `postgres://galaxis:galaxis@${container.getHost()}:${container.getMappedPort(5432)}/galaxis_test`;
    } catch (error) {
      console.warn(
        `Skipping PostgreSQL integration tests because Docker is unavailable: ${String(error)}`,
      );
    }
  }, 150000);

  afterAll(async () => {
    await container?.stop();
  });

  it("migrates an empty database idempotently and verifies checksums", async ({ skip }) => {
    if (connectionString === undefined) return skip();
    const pool = new Pool({ connectionString });

    try {
      const first = await runMigrations(pool, migrationDirectory);
      const second = await runMigrations(pool, migrationDirectory);
      await checkMigrations(pool, migrationDirectory);
      const result = await pool.query<{ version: number; name: string }>(
        "SELECT version, name FROM schema_migrations ORDER BY version",
      );

      expect(first.appliedVersions).toEqual([1]);
      expect(second.appliedVersions).toEqual([]);
      expect(result.rows).toEqual([{ version: 1, name: "create-schema-migrations" }]);
    } finally {
      await pool.end();
    }
  });

  it("rolls back every migration when one migration fails", async ({ skip }) => {
    if (connectionString === undefined) return skip();
    const pool = new Pool({ connectionString });
    const directory = await mkdtemp(join(tmpdir(), "galaxis-failing-migrations-"));

    try {
      await writeFile(
        join(directory, "001-create-marker.sql"),
        "CREATE TABLE migration_marker (id INTEGER PRIMARY KEY);\n",
        "utf8",
      );
      await writeFile(
        join(directory, "002-fail.sql"),
        "INSERT INTO migration_marker (id) VALUES (1);\nSELECT 1 / 0;\n",
        "utf8",
      );

      await expect(runMigrations(pool, directory)).rejects.toThrow("all changes were rolled back");
      await expect(pool.query("SELECT 1 FROM migration_marker")).rejects.toThrow();
      await expect(pool.query("SELECT 1 FROM schema_migrations")).rejects.toThrow();
    } finally {
      await pool.end();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps migration SQL independent from the application schema", async () => {
    const sql = await readFile(
      join(migrationDirectory, "001-create-schema-migrations.sql"),
      "utf8",
    );

    expect(sql).not.toContain("account");
    expect(sql).toContain("schema_migrations");
  });
});

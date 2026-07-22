import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MigrationError, loadMigrations } from "../../src/infrastructure/database/migrations.js";

describe("migration files", () => {
  it("loads migrations in numeric order with stable checksums", async () => {
    const directory = await mkdtemp(join(tmpdir(), "galaxis-migrations-"));
    try {
      await writeFile(join(directory, "002-second.sql"), "SELECT 2;\n", "utf8");
      await writeFile(join(directory, "001-first.sql"), "SELECT 1;\n", "utf8");

      const migrations = await loadMigrations(directory);

      expect(migrations.map((migration) => migration.version)).toEqual([1, 2]);
      expect(migrations[0]?.checksum).toMatch(/^[a-f0-9]{64}$/u);
      expect(migrations[0]?.filename).toBe("001-first.sql");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects ambiguous migration filenames", async () => {
    const directory = await mkdtemp(join(tmpdir(), "galaxis-migrations-"));
    try {
      await writeFile(join(directory, "first.sql"), "SELECT 1;\n", "utf8");

      await expect(loadMigrations(directory)).rejects.toBeInstanceOf(MigrationError);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

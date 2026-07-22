// Feature: GAL-PLATFORM-DB-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import { fileURLToPath } from "node:url";

import { loadConfig } from "../config/config.js";
import { createPostgresDatabase } from "./database.js";
import { checkMigrations, runMigrations } from "./migrations.js";

const migrationDirectory = fileURLToPath(new URL("../../../migrations/", import.meta.url));

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.databaseUrl === undefined) {
    throw new Error("GALAXIS_DATABASE_URL is required for database migrations");
  }

  const database = createPostgresDatabase(config);
  try {
    if (process.argv.includes("--check")) {
      await checkMigrations(database.pool, migrationDirectory);
      console.log("Database migrations are up to date.");
      return;
    }

    const result = await runMigrations(database.pool, migrationDirectory);
    const applied = result.appliedVersions.length;
    console.log(
      applied === 0
        ? "Database migrations are already up to date."
        : `Applied ${applied} migration(s).`,
    );
  } finally {
    await database.close();
  }
}

await main();

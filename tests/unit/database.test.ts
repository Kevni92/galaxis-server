import { describe, expect, it } from "vitest";

import { createPostgresDatabase } from "../../src/infrastructure/database/database.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";

describe("PostgreSQL adapter", () => {
  it("closes its Kysely pool without requiring a live database", async () => {
    const database = createPostgresDatabase(
      loadConfig({
        GALAXIS_PORT: "3000",
        GALAXIS_LOG_LEVEL: "silent",
        GALAXIS_DATABASE_URL: "postgres://galaxis:galaxis@127.0.0.1:1/galaxis",
      }),
    );

    await database.close();
    await expect(database.pool.query("SELECT 1")).rejects.toThrow();
    await database.close();
  });
});

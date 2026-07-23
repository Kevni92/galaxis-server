import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Pool } from "pg";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

import { KyselyAccountRepository } from "../../src/infrastructure/accounts/repository.js";
import { KyselyCampaignRepository } from "../../src/infrastructure/campaigns/repository.js";
import { KyselyEmpireRepository } from "../../src/infrastructure/empires/repository.js";
import { KyselySessionRepository } from "../../src/infrastructure/sessions/repository.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";
import { createPostgresDatabase } from "../../src/infrastructure/database/database.js";
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
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/u, 2))
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

      expect(first.appliedVersions).toEqual([1, 2, 3, 4, 5]);
      expect(second.appliedVersions).toEqual([]);
      expect(result.rows).toEqual([
        { version: 1, name: "create-schema-migrations" },
        { version: 2, name: "create-accounts" },
        { version: 3, name: "create-sessions" },
        { version: 4, name: "create-campaigns" },
        { version: 5, name: "create-empires" },
      ]);
    } finally {
      await pool.end();
    }
  });

  it("rolls back every migration when one migration fails", async ({ skip }) => {
    if (connectionString === undefined) return skip();
    const pool = new Pool({ connectionString });
    const directory = await mkdtemp(join(tmpdir(), "galaxis-failing-migrations-"));

    try {
      for (const filename of [
        "001-create-schema-migrations.sql",
        "002-create-accounts.sql",
        "003-create-sessions.sql",
        "004-create-campaigns.sql",
        "005-create-empires.sql",
      ]) {
        await writeFile(
          join(directory, filename),
          await readFile(join(migrationDirectory, filename), "utf8"),
          "utf8",
        );
      }
      await writeFile(
        join(directory, "006-fail.sql"),
        "CREATE TABLE migration_marker (id INTEGER PRIMARY KEY);\nSELECT 1 / 0;\n",
        "utf8",
      );

      await expect(runMigrations(pool, directory)).rejects.toThrow("all changes were rolled back");
      await expect(pool.query("SELECT 1 FROM migration_marker")).rejects.toThrow();
      await expect(
        pool.query("SELECT version FROM schema_migrations ORDER BY version"),
      ).resolves.toMatchObject({
        rows: [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }],
      });
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

  it("persists opaque account IDs and treats duplicate emails as a safe conflict", async ({
    skip,
  }) => {
    if (connectionString === undefined) return skip();
    const database = createPostgresDatabase(
      loadConfig({
        GALAXIS_PORT: "3000",
        GALAXIS_LOG_LEVEL: "silent",
        GALAXIS_DATABASE_URL: connectionString,
      }),
    );
    const repository = new KyselyAccountRepository(database.db);

    try {
      const account = {
        id: "acc_integration_0001",
        email: "integration@example.com",
        passwordHash: "$argon2id$v=19$test-hash",
        createdAt: Date.UTC(2026, 0, 2),
      };

      expect(await repository.create(account)).toBe(true);
      expect(await repository.create({ ...account, id: "acc_integration_0002" })).toBe(false);
      const result = await database.pool.query<{ account_id: string; password_hash: string }>(
        "SELECT account_id, password_hash FROM accounts WHERE email = $1",
        [account.email],
      );

      expect(result.rows).toEqual([
        { account_id: account.id, password_hash: account.passwordHash },
      ]);
      expect(result.rows[0]?.password_hash).not.toBe("secret");
    } finally {
      await database.close();
    }
  });

  it("stores session hashes, updates last-used time, and revokes sessions", async ({ skip }) => {
    if (connectionString === undefined) return skip();
    const database = createPostgresDatabase(
      loadConfig({
        GALAXIS_PORT: "3000",
        GALAXIS_LOG_LEVEL: "silent",
        GALAXIS_DATABASE_URL: connectionString,
      }),
    );
    const accountRepository = new KyselyAccountRepository(database.db);
    const sessionRepository = new KyselySessionRepository(database.db);

    try {
      await accountRepository.create({
        id: "acc_session_integration_0001",
        email: "session-integration@example.com",
        passwordHash: "$argon2id$v=19$integration-hash",
        createdAt: Date.UTC(2026, 0, 2),
      });
      const session = {
        id: "ses_integration_0001",
        accountId: "acc_session_integration_0001",
        tokenHash: "sha256-session-hash",
        createdAt: Date.UTC(2026, 0, 2),
        expiresAt: Date.UTC(2026, 0, 9),
        lastUsedAt: null,
        revokedAt: null,
      };

      await sessionRepository.create(session);
      const active = await sessionRepository.findActiveByTokenHash(
        session.tokenHash,
        Date.UTC(2026, 0, 3),
      );
      expect(active).toMatchObject({
        id: session.id,
        accountId: session.accountId,
        tokenHash: session.tokenHash,
        lastUsedAt: Date.UTC(2026, 0, 3),
      });
      expect(await sessionRepository.revoke(session.id, Date.UTC(2026, 0, 4))).toBe(true);
      expect(
        await sessionRepository.findActiveByTokenHash(session.tokenHash, Date.UTC(2026, 0, 4)),
      ).toBeUndefined();

      const result = await database.pool.query<{ token_hash: string }>(
        "SELECT token_hash FROM sessions WHERE session_id = $1",
        [session.id],
      );
      expect(result.rows).toEqual([{ token_hash: session.tokenHash }]);
      expect(result.rows[0]?.token_hash).not.toBe("galaxis_session_opaque_token");
    } finally {
      await database.close();
    }
  });

  it("persists a campaign, its participant, and its start empire atomically", async ({ skip }) => {
    if (connectionString === undefined) return skip();
    const database = createPostgresDatabase(
      loadConfig({
        GALAXIS_PORT: "3000",
        GALAXIS_LOG_LEVEL: "silent",
        GALAXIS_DATABASE_URL: connectionString,
      }),
    );
    const accountRepository = new KyselyAccountRepository(database.db);
    const campaignRepository = new KyselyCampaignRepository(database.db);
    const empireRepository = new KyselyEmpireRepository(database.db);
    const campaign = {
      id: "cmp_integration_0001",
      ownerAccountId: "acc_campaign_integration_0001",
      type: "singleplayer" as const,
      status: "running" as const,
      seed: 42,
      timeProfile: "standard",
      balancingVersion: "0.1.0-baseline",
      catalogVersion: "0.1.0-baseline",
      balancingHash: "b".repeat(64),
      stateVersion: 1,
      campaignTimeMs: 0,
      idempotencyKey: "create-1",
      creationFingerprint: '[42,"standard"]',
      createdAt: Date.UTC(2026, 0, 2),
    };
    const empire = {
      id: "emp_integration_0001",
      campaignId: campaign.id,
      name: "Startreich",
      status: "aktiv" as const,
      knowledge: { knownSystemIds: [], knownPlanetIds: [] },
    };
    const controller = {
      empireId: empire.id,
      accountId: campaign.ownerAccountId,
      controllerType: "player" as const,
      canRead: true,
      canControl: true,
    };
    const creation = { campaign, empire, controller };

    try {
      await accountRepository.create({
        id: campaign.ownerAccountId,
        email: "campaign-integration@example.com",
        passwordHash: "$argon2id$v=19$test-hash",
        createdAt: campaign.createdAt,
      });

      await expect(campaignRepository.create(creation)).resolves.toMatchObject({ kind: "created" });
      await expect(
        campaignRepository.create({ ...creation, campaign: { ...campaign, id: "cmp_other_id" } }),
      ).resolves.toEqual({ kind: "existing", campaign });
      await expect(campaignRepository.listForAccount(campaign.ownerAccountId)).resolves.toEqual([
        campaign,
      ]);
      await expect(
        campaignRepository.findForAccount("another-account", campaign.id),
      ).resolves.toBeUndefined();

      const participant = await database.pool.query(
        "SELECT account_id, participant_role, can_read, can_control FROM campaign_participants WHERE campaign_id = $1",
        [campaign.id],
      );
      expect(participant.rows).toEqual([
        {
          account_id: campaign.ownerAccountId,
          participant_role: "owner",
          can_read: true,
          can_control: true,
        },
      ]);

      // Reload erhält Reichsidentität, Zuordnung und leeren Wissenscontainer.
      await expect(
        empireRepository.listReadableForAccount(campaign.ownerAccountId, campaign.id),
      ).resolves.toEqual([{ empire, controller }]);
      await expect(
        empireRepository.findReadableForAccount(campaign.ownerAccountId, empire.id),
      ).resolves.toEqual({ empire, controller });

      // Ein fremder Account steuert oder liest das Startreich nicht.
      await expect(
        empireRepository.findReadableForAccount("another-account", empire.id),
      ).resolves.toBeUndefined();
      await expect(
        empireRepository.listReadableForAccount("another-account", campaign.id),
      ).resolves.toEqual([]);
    } finally {
      await database.close();
    }
  });
});

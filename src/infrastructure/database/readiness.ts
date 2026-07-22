// Feature: GAL-PLATFORM-DB-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import type { ReadinessProbe } from "../../application/health/readiness.js";

import type { PostgresDatabase } from "./database.js";

export class PostgresReadinessProbe implements ReadinessProbe {
  public constructor(private readonly database: Pick<PostgresDatabase, "checkHealth">) {}

  public async check(): Promise<{ ready: true } | { ready: false }> {
    return (await this.database.checkHealth()) ? { ready: true } : { ready: false };
  }
}

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const architectureScript = fileURLToPath(
  new URL("../../scripts/check-architecture.mjs", import.meta.url),
);
const forbiddenFixture = fileURLToPath(
  new URL("../fixtures/architecture/forbidden-domain-import.ts", import.meta.url),
);
const forbiddenAccessFixture = fileURLToPath(
  new URL("../fixtures/architecture/forbidden-domain-access.ts", import.meta.url),
);

describe("architecture boundary checker", () => {
  it("rejects a forbidden technical import in the domain fixture", () => {
    const result = spawnSync(process.execPath, [architectureScript, forbiddenFixture], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fastify");
  });

  it("rejects direct system time access in the domain fixture", () => {
    const result = spawnSync(process.execPath, [architectureScript, forbiddenAccessFixture], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("forbidden direct time or randomness access");
  });
});

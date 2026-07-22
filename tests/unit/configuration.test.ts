import { describe, expect, it } from "vitest";

import { ConfigurationError, loadConfig } from "../../src/infrastructure/config/config.js";
import { redactedConfig } from "../../src/infrastructure/logging/logger.js";

describe("runtime configuration", () => {
  it("validates and freezes the typed configuration", () => {
    const config = loadConfig({
      GALAXIS_PORT: "3001",
      GALAXIS_LOG_LEVEL: "debug",
      GALAXIS_DATABASE_URL: "postgres://galaxis:secret@localhost/galaxis",
    });

    expect(config.port).toBe(3001);
    expect(config.logLevel).toBe("debug");
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("rejects missing or invalid required values without echoing secrets", () => {
    expect(() =>
      loadConfig({
        GALAXIS_PORT: "not-a-port",
        GALAXIS_LOG_LEVEL: "info",
        GALAXIS_DATABASE_URL: "postgres://galaxis:super-secret@localhost/galaxis",
      }),
    ).toThrow(ConfigurationError);

    try {
      loadConfig({
        GALAXIS_PORT: "not-a-port",
        GALAXIS_LOG_LEVEL: "info",
        GALAXIS_DATABASE_URL: "postgres://galaxis:super-secret@localhost/galaxis",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).not.toContain("super-secret");
    }
  });

  it("redacts sensitive configuration fields from startup metadata", () => {
    const config = loadConfig({
      GALAXIS_PORT: "3000",
      GALAXIS_LOG_LEVEL: "info",
      GALAXIS_DATABASE_URL: "postgres://galaxis:super-secret@localhost/galaxis",
    });

    expect(redactedConfig(config)).not.toHaveProperty("databaseUrl");
  });
});

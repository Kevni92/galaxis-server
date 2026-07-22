import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createApplication } from "../../src/app/composition-root/application.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";
import { FileSystemBalancingLoader } from "../../src/infrastructure/balancing/loader.js";
import {
  BalancingValidationError,
  loadBalancingConfiguration,
} from "../../src/infrastructure/balancing/schema.js";
import { InMemoryBalancingLoader } from "../../src/infrastructure/balancing/loader.js";

function validDocument(): Record<string, unknown> {
  return {
    schemaVersion: "1.0",
    balancingVersion: "0.1.0-baseline",
    catalogVersion: "0.1.0-baseline",
    status: "baseline",
    effectiveFrom: "new_campaigns",
    sources: ["docs/balancing/data-format.md"],
    units: ["campaign_days"],
    parameters: {
      campaign_window_days: {
        value: 10,
        unit: "campaign_days",
        minimum: 0,
        maximum: 60,
        sourceSection: "Kampagnenprofil",
      },
      reserve_target_days: {
        value: 10,
        unit: "campaign_days",
        minimum: 0,
        maximum: 60,
        references: ["campaign_window_days"],
      },
    },
  };
}

function expectValidationIssue(input: Record<string, unknown>, code: string, path: string): void {
  try {
    loadBalancingConfiguration(input);
    throw new Error("expected balancing validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(BalancingValidationError);
    const validationError = error as BalancingValidationError;
    expect(validationError.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code, path })]),
    );
  }
}

describe("versioned balancing loader", () => {
  it("validates, freezes and hashes a balancing document", () => {
    const loaded = loadBalancingConfiguration(validDocument());

    expect(loaded.hash).toBe("2ff0c74242b6452cccbffd4bbbceb43370e907f67969b4fe12866798924c5f52");
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.parameters)).toBe(true);
    expect(Object.isFrozen(loaded.parameters.reserve_target_days)).toBe(true);
    expect(Reflect.set(loaded.parameters, "new_parameter", {})).toBe(false);
  });

  it("produces the same hash when object keys are reordered", () => {
    const first = loadBalancingConfiguration(validDocument());
    const reordered = validDocument();
    reordered.parameters = {
      reserve_target_days: (validDocument().parameters as Record<string, unknown>)
        .reserve_target_days,
      campaign_window_days: (validDocument().parameters as Record<string, unknown>)
        .campaign_window_days,
    };

    expect(loadBalancingConfiguration(reordered).hash).toBe(first.hash);
  });

  it("reports missing source, unit and reference with paths and parameter IDs", () => {
    const missingSource = validDocument();
    delete missingSource.sources;
    expectValidationIssue(missingSource, "schema", "/sources");

    const missingUnit = validDocument();
    const missingUnitParameters = missingUnit.parameters as Record<string, Record<string, unknown>>;
    missingUnitParameters.reserve_target_days!.unit = "unregistered_unit";
    expectValidationIssue(missingUnit, "unknown_unit", "/parameters/reserve_target_days/unit");

    const missingReference = validDocument();
    const missingReferenceParameters = missingReference.parameters as Record<
      string,
      Record<string, unknown>
    >;
    missingReferenceParameters.reserve_target_days!.references = ["missing_parameter"];
    expectValidationIssue(
      missingReference,
      "unknown_reference",
      "/parameters/reserve_target_days/references",
    );
  });

  it("rejects cycles and invalid numeric ranges", () => {
    const invalid = validDocument();
    const parameters = invalid.parameters as Record<string, Record<string, unknown>>;
    parameters.reserve_target_days!.references = ["campaign_window_days"];
    parameters.campaign_window_days!.references = ["reserve_target_days"];
    parameters.reserve_target_days!.minimum = 20;
    parameters.reserve_target_days!.maximum = 10;

    expect(() => loadBalancingConfiguration(invalid)).toThrow(BalancingValidationError);
    try {
      loadBalancingConfiguration(invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(BalancingValidationError);
      expect((error as BalancingValidationError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "invalid_range" }),
          expect.objectContaining({ code: "reference_cycle" }),
        ]),
      );
    }
  });

  it("loads the committed A0 manifest through the filesystem adapter", async () => {
    const path = fileURLToPath(new URL("../../data/balancing/manifest.json", import.meta.url));
    const loaded = await new FileSystemBalancingLoader(path).load();

    expect(loaded.balancingVersion).toBe("0.1.0-baseline");
    expect(loaded.catalogVersion).toBe("0.1.0-baseline");
    expect(loaded.parameters).toEqual({});
  });

  it("loads balancing before listening and exposes its versioned status", async () => {
    const application = createApplication(
      loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" }),
      { balancingLoader: new InMemoryBalancingLoader(validDocument()) },
    );

    await application.start();
    try {
      expect(application.balancingConfiguration?.balancingVersion).toBe("0.1.0-baseline");
      expect(application.balancingConfiguration?.hash).toBe(
        "2ff0c74242b6452cccbffd4bbbceb43370e907f67969b4fe12866798924c5f52",
      );
    } finally {
      await application.shutdown("test");
    }
  });

  it("uses the committed A0 manifest when no loader override is supplied", async () => {
    const application = createApplication(
      loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" }),
    );

    await application.start();
    try {
      expect(application.balancingConfiguration?.parameters).toEqual({});
      expect(application.balancingConfiguration?.hash).toMatch(/^[0-9a-f]{64}$/u);
    } finally {
      await application.shutdown("test");
    }
  });

  it("does not start the server when balancing data is invalid", async () => {
    const invalid = validDocument();
    delete invalid.sources;
    const application = createApplication(
      loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" }),
      { balancingLoader: new InMemoryBalancingLoader(invalid) },
    );

    await expect(application.start()).rejects.toBeInstanceOf(BalancingValidationError);
    expect(application.server.server.listening).toBe(false);
    await application.shutdown("test");
  });
});

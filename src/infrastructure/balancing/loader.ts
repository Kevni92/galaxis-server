// Feature: GAL-BAL-DATA-001
// Fachliche Grundlage: docs/balancing/data-format.md
// Architekturentscheidung: docs/decisions/0004-versionierte-balancing-schicht.md

import { readFile } from "node:fs/promises";

import type {
  BalancingLoader,
  LoadedBalancingConfiguration,
} from "../../application/balancing/loader.js";
import { BalancingValidationError, loadBalancingConfiguration } from "./schema.js";

export class BalancingLoadError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BalancingLoadError";
  }
}

/** Infrastructure adapter that reads one immutable JSON snapshot at load time. */
export class FileSystemBalancingLoader implements BalancingLoader {
  private readonly path: string;

  public constructor(path: string) {
    if (path.length === 0) throw new RangeError("path must not be empty");
    this.path = path;
  }

  public async load(): Promise<LoadedBalancingConfiguration> {
    let contents: string;
    try {
      contents = await readFile(this.path, "utf8");
    } catch {
      throw new BalancingLoadError(`Unable to read balancing data at '${this.path}'`);
    }

    let input: unknown;
    try {
      input = JSON.parse(contents) as unknown;
    } catch {
      throw new BalancingValidationError([
        {
          path: "/",
          code: "invalid_json",
          message: "/: balancing data is not valid JSON",
        },
      ]);
    }
    return loadBalancingConfiguration(input);
  }
}

/** Repeatable fake loader for unit tests and headless callers. */
export class InMemoryBalancingLoader implements BalancingLoader {
  private readonly input: unknown;

  public constructor(input: unknown) {
    this.input = input;
  }

  public async load(): Promise<LoadedBalancingConfiguration> {
    return loadBalancingConfiguration(this.input);
  }
}

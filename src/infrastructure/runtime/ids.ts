// Feature: GAL-SIM-RUNTIME-001
// Fachliche Grundlage: docs/decisions/0003-mvp-simulations-und-schnittstellenmodell.md
// Ports: src/application/runtime/ids.ts and random.ts

import type { IdGenerator, ResourceId, ResourceIdPrefix } from "../../application/runtime/ids.js";
import type { CryptographicRandomSource } from "../../application/runtime/random.js";

const DEFAULT_ENTROPY_BYTES = 16;
const MAX_COLLISION_RETRIES = 8;

function assertPrefix(prefix: ResourceIdPrefix): void {
  if (!/^[a-z][a-z0-9-]*$/u.test(prefix)) {
    throw new RangeError(
      "prefix must start with a lowercase letter and contain only a-z, 0-9, or -",
    );
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface PrefixedIdGeneratorOptions {
  readonly entropyBytes?: number;
  readonly maxCollisionRetries?: number;
}

/** Prefixes opaque cryptographic entropy and rejects collisions in its process lifetime. */
export class PrefixedIdGenerator implements IdGenerator {
  private readonly entropyBytes: number;
  private readonly maxCollisionRetries: number;
  private readonly source: CryptographicRandomSource;
  private readonly issued = new Set<ResourceId>();

  public constructor(source: CryptographicRandomSource, options: PrefixedIdGeneratorOptions = {}) {
    this.entropyBytes = options.entropyBytes ?? DEFAULT_ENTROPY_BYTES;
    this.maxCollisionRetries = options.maxCollisionRetries ?? MAX_COLLISION_RETRIES;
    if (!Number.isInteger(this.entropyBytes) || this.entropyBytes < 16) {
      throw new RangeError("entropyBytes must be an integer of at least 16");
    }
    if (!Number.isInteger(this.maxCollisionRetries) || this.maxCollisionRetries < 1) {
      throw new RangeError("maxCollisionRetries must be a positive integer");
    }
    this.source = source;
  }

  public next(prefix: ResourceIdPrefix): ResourceId {
    assertPrefix(prefix);

    for (let attempt = 0; attempt < this.maxCollisionRetries; attempt += 1) {
      const id = `${prefix}_${bytesToHex(this.source.randomBytes(this.entropyBytes))}`;
      if (!this.issued.has(id)) {
        this.issued.add(id);
        return id;
      }
    }

    throw new Error("Unable to allocate a collision-free resource ID");
  }
}

/** Deterministic ID provider for unit tests; production IDs never use this format. */
export class FakeIdGenerator implements IdGenerator {
  private readonly counters = new Map<ResourceIdPrefix, number>();

  public next(prefix: ResourceIdPrefix): ResourceId {
    assertPrefix(prefix);
    const counter = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, counter);
    return `${prefix}_fake_${counter.toString(10).padStart(4, "0")}`;
  }
}

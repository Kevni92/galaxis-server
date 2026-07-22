// Feature: GAL-SIM-RUNTIME-001
// Fachliche Grundlage: docs/decisions/0003-mvp-simulations-und-schnittstellenmodell.md
// Architekturentscheidung: docs/decisions/0005-a0-server-technologiestack.md

import { randomBytes as nodeRandomBytes } from "node:crypto";

import type { CryptographicRandomSource, RandomStream } from "../../application/runtime/random.js";

/** Algorithm identifier persisted with deterministic simulation metadata. */
export const SIMULATION_PRNG_ALGORITHM = "xorshift32-v1";

const UINT32_RANGE = 0x1_0000_0000;

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer`);
  }
}

function assertBound(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("maxExclusive must be an integer from 1 to 2^32");
  }
}

function streamState(seed: number, streamId: string): number {
  assertUint32(seed, "seed");

  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let index = 0; index < streamId.length; index += 1) {
    hash ^= streamId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash === 0 ? 0x6d2b79f5 : hash;
}

function boundedInteger(nextUint32: () => number, maxExclusive: number): number {
  assertBound(maxExclusive);
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let value = nextUint32();
  while (value >= limit) value = nextUint32();
  return value % maxExclusive;
}

/**
 * Integer-only xorshift32 stream. Each stream derives an independent state from
 * the numeric seed and stream ID; no global state or Math.random() is involved.
 */
export class XorShift32RandomStream implements RandomStream {
  public readonly algorithm = SIMULATION_PRNG_ALGORITHM;
  public readonly seed: number;
  public readonly streamId: string;
  private state: number;

  public constructor(seed: number, streamId: string) {
    assertUint32(seed, "seed");
    if (streamId.length === 0) throw new RangeError("streamId must not be empty");
    this.seed = seed;
    this.streamId = streamId;
    this.state = streamState(seed, streamId);
  }

  public nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  public nextInt(maxExclusive: number): number {
    return boundedInteger(() => this.nextUint32(), maxExclusive);
  }
}

/** Backwards-readable name for the production simulation stream. */
export const SeededRandomStream = XorShift32RandomStream;

/** Sequence-backed stream for tests; exhaustion fails instead of silently adding randomness. */
export class FakeRandomStream implements RandomStream {
  public readonly algorithm = "fake-sequence-v1";
  public readonly seed = 0;
  public readonly streamId = "fake";
  private readonly values: readonly number[];
  private index = 0;

  public constructor(values: readonly number[]) {
    if (values.length === 0) throw new RangeError("values must not be empty");
    values.forEach((value, index) => assertUint32(value, `values[${index}]`));
    this.values = [...values];
  }

  public nextUint32(): number {
    const value = this.values[this.index];
    if (value === undefined) throw new Error("FakeRandomStream sequence exhausted");
    this.index += 1;
    return value;
  }

  public nextInt(maxExclusive: number): number {
    return boundedInteger(() => this.nextUint32(), maxExclusive);
  }
}

function assertByteLength(length: number): void {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError("length must be a non-negative integer");
  }
}

/** Production cryptographic source; its state is unrelated to campaign seeds. */
export class NodeCryptographicRandomSource implements CryptographicRandomSource {
  public randomBytes(length: number): Uint8Array {
    assertByteLength(length);
    return new Uint8Array(nodeRandomBytes(length));
  }
}

/** Byte-fixture source for tests of ID and authentication adapters. */
export class FakeCryptographicRandomSource implements CryptographicRandomSource {
  private readonly bytes: Uint8Array;
  private offset = 0;

  public constructor(bytes: Uint8Array | readonly number[]) {
    this.bytes = Uint8Array.from(bytes);
  }

  public randomBytes(length: number): Uint8Array {
    assertByteLength(length);
    const end = this.offset + length;
    if (end > this.bytes.length) throw new Error("FakeCryptographicRandomSource exhausted");
    const result = this.bytes.slice(this.offset, end);
    this.offset = end;
    return result;
  }
}

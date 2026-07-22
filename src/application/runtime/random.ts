// Feature: GAL-SIM-RUNTIME-001
// Fachliche Grundlage: docs/decisions/0003-mvp-simulations-und-schnittstellenmodell.md
// Architekturentscheidung: docs/decisions/0005-a0-server-technologiestack.md

/** Seeded randomness for simulation state; it must never be used for auth secrets. */
export interface RandomStream {
  readonly algorithm: string;
  readonly seed: number;
  readonly streamId: string;
  nextUint32(): number;
  nextInt(maxExclusive: number): number;
}

/** Cryptographically secure bytes for security-sensitive adapters such as auth. */
export interface CryptographicRandomSource {
  randomBytes(length: number): Uint8Array;
}

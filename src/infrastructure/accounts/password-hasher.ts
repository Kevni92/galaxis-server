// Feature: GAL-AUTH-ACCOUNT-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import argon2 from "argon2";

export interface Argon2PasswordHasherOptions {
  readonly timeCost?: number;
  readonly memoryCost?: number;
  readonly parallelism?: number;
  readonly hashLength?: number;
  readonly saltLength?: number;
}

export const ARGON2ID_PASSWORD_OPTIONS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 65_536,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
} as const;

/** A fixed valid Argon2id hash keeps unknown-account verification timing comparable. */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$aSx0bGqJIA8lAG7pt86iMA$qkNyd/ibAz4N+DPOvBEIqR9zVwfKEIIijPqTbnKcgE4";

interface Argon2PasswordOptions {
  readonly type: typeof argon2.argon2id;
  readonly timeCost: number;
  readonly memoryCost: number;
  readonly parallelism: number;
  readonly hashLength: number;
  readonly saltLength: number;
}

/** Argon2id is the only production password hashing adapter. */
export class Argon2PasswordHasher {
  private readonly options: Argon2PasswordOptions;

  public constructor(options: Argon2PasswordHasherOptions = {}) {
    this.options = {
      type: ARGON2ID_PASSWORD_OPTIONS.type,
      timeCost: options.timeCost ?? ARGON2ID_PASSWORD_OPTIONS.timeCost,
      memoryCost: options.memoryCost ?? ARGON2ID_PASSWORD_OPTIONS.memoryCost,
      parallelism: options.parallelism ?? ARGON2ID_PASSWORD_OPTIONS.parallelism,
      hashLength: options.hashLength ?? ARGON2ID_PASSWORD_OPTIONS.hashLength,
      saltLength: options.saltLength ?? ARGON2ID_PASSWORD_OPTIONS.saltLength,
    };
  }

  public hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  public verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }
}

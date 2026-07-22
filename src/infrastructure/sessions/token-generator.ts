// Feature: GAL-AUTH-SESSION-001
// Fachliche Grundlage: docs/decisions/0005-a0-server-technologiestack.md

import { createHash } from "node:crypto";

import type { SessionToken, SessionTokenGenerator } from "../../application/sessions/ports.js";
import type { CryptographicRandomSource } from "../../application/runtime/random.js";

const DEFAULT_TOKEN_BYTES = 32;

export class OpaqueSessionTokenGenerator implements SessionTokenGenerator {
  private readonly randomSource: CryptographicRandomSource;
  private readonly tokenBytes: number;

  public constructor(randomSource: CryptographicRandomSource, tokenBytes = DEFAULT_TOKEN_BYTES) {
    if (!Number.isInteger(tokenBytes) || tokenBytes < 32) {
      throw new RangeError("tokenBytes must be an integer of at least 32");
    }
    this.randomSource = randomSource;
    this.tokenBytes = tokenBytes;
  }

  public create(): SessionToken {
    const value = `galaxis_session_${Buffer.from(
      this.randomSource.randomBytes(this.tokenBytes),
    ).toString("base64url")}`;
    return { value, hash: this.hash(value) };
  }

  public hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }
}

import { describe, expect, it } from "vitest";

import { FakeCryptographicRandomSource } from "../../src/infrastructure/runtime/random.js";
import { OpaqueSessionTokenGenerator } from "../../src/infrastructure/sessions/token-generator.js";

describe("opaque session token generator", () => {
  it("generates a cryptographic-looking token and a separate SHA-256 hash", () => {
    const generator = new OpaqueSessionTokenGenerator(
      new FakeCryptographicRandomSource(new Array(32).fill(7)),
    );

    const token = generator.create();

    expect(token.value).toMatch(/^galaxis_session_[A-Za-z0-9_-]+$/u);
    expect(token.hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(token.hash).not.toContain(token.value);
    expect(generator.hash(token.value)).toBe(token.hash);
  });
});

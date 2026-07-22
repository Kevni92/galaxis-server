import { describe, expect, it } from "vitest";

import {
  Argon2PasswordHasher,
  DUMMY_PASSWORD_HASH,
} from "../../src/infrastructure/accounts/password-hasher.js";

describe("Argon2id password hasher", () => {
  it("hashes and verifies passwords without retaining the plaintext", async () => {
    const hasher = new Argon2PasswordHasher({ timeCost: 1, memoryCost: 4_096 });
    const password = "correct horse battery staple";

    const passwordHash = await hasher.hash(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash).toMatch(/^\$argon2id\$/u);
    await expect(hasher.verify(passwordHash, password)).resolves.toBe(true);
    await expect(hasher.verify(passwordHash, "wrong password")).resolves.toBe(false);
  });

  it("keeps the unknown-account timing hash valid for Argon2id verification", async () => {
    const hasher = new Argon2PasswordHasher();

    await expect(hasher.verify(DUMMY_PASSWORD_HASH, "galaxis-invalid-account-dummy")).resolves.toBe(
      true,
    );
  });
});

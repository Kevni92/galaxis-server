import { describe, expect, it } from "vitest";

import { AccountRegistrationService } from "../../src/application/accounts/registration.js";
import type { AccountRepository, PasswordHasher } from "../../src/application/accounts/ports.js";
import { FakeWallClock } from "../../src/infrastructure/runtime/clocks.js";
import { FakeIdGenerator } from "../../src/infrastructure/runtime/ids.js";

function createService(options: { readonly createResult?: boolean } = {}): {
  service: AccountRegistrationService;
  accounts: { email: string; passwordHash: string }[];
} {
  const accounts: { email: string; passwordHash: string }[] = [];
  const repository: AccountRepository = {
    create: async (account) => {
      accounts.push({ email: account.email, passwordHash: account.passwordHash });
      return options.createResult ?? true;
    },
  };
  const passwordHasher: PasswordHasher = {
    hash: async () => "argon2id$fake-hash",
    verify: async () => true,
  };

  return {
    accounts,
    service: new AccountRegistrationService({
      repository,
      passwordHasher,
      idGenerator: new FakeIdGenerator(),
      wallClock: new FakeWallClock(Date.UTC(2026, 0, 2, 3, 4, 5)),
    }),
  };
}

describe("account registration", () => {
  it("normalizes the login identifier and never returns password material", async () => {
    const { service, accounts } = createService();

    const result = await service.register({ email: "  User@Example.COM ", password: "secret" });

    expect(result).toEqual({
      accountId: "acc_fake_0001",
      email: "user@example.com",
      createdAt: "2026-01-02T03:04:05.000Z",
    });
    expect(accounts).toEqual([{ email: "user@example.com", passwordHash: "argon2id$fake-hash" }]);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("rejects invalid email input without exposing registration state", async () => {
    const { service } = createService();

    await expect(
      service.register({ email: "not-an-email", password: "secret" }),
    ).rejects.toMatchObject({
      code: "ACCOUNT_REGISTRATION_REJECTED",
      message: "Die Registrierung konnte nicht abgeschlossen werden.",
      details: [{ field: "email", reason: "INVALID_FORMAT" }],
      retryable: false,
    });
  });

  it("uses the same generic rejection for duplicate identifiers", async () => {
    const { service } = createService({ createResult: false });

    await expect(
      service.register({ email: "user@example.com", password: "secret" }),
    ).rejects.toMatchObject({
      code: "ACCOUNT_REGISTRATION_REJECTED",
      message: "Die Registrierung konnte nicht abgeschlossen werden.",
      retryable: false,
    });
  });

  it("checks an optional rate-limit port before hashing", async () => {
    let hashCalled = false;
    const service = new AccountRegistrationService({
      repository: { create: async () => true },
      passwordHasher: {
        hash: async () => {
          hashCalled = true;
          return "hash";
        },
        verify: async () => true,
      },
      idGenerator: new FakeIdGenerator(),
      wallClock: new FakeWallClock(),
      rateLimiter: {
        allow: async (key) => (key === "blocked-client" ? false : true),
      },
    });

    await expect(
      service.register({
        email: "user@example.com",
        password: "secret",
        rateLimitKey: "blocked-client",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retryable: true });
    expect(hashCalled).toBe(false);
  });
});

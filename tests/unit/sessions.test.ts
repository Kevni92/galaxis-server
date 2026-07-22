import { describe, expect, it } from "vitest";

import type {
  AccountCredentialReader,
  PasswordHasher,
} from "../../src/application/accounts/ports.js";
import { SessionService } from "../../src/application/sessions/service.js";
import type {
  SessionRepository,
  SessionTokenGenerator,
} from "../../src/application/sessions/ports.js";
import type { Account } from "../../src/domain/accounts/account.js";
import type { Session } from "../../src/domain/sessions/session.js";
import { FakeWallClock } from "../../src/infrastructure/runtime/clocks.js";
import { FakeIdGenerator } from "../../src/infrastructure/runtime/ids.js";

const account: Account = {
  id: "acc_fake_0001",
  email: "captain@example.test",
  passwordHash: "stored-password-hash",
  createdAt: 0,
};

class FakeSessionRepository implements SessionRepository {
  public session: Session | undefined;

  public async create(session: Session): Promise<void> {
    this.session = session;
  }

  public async findActiveByTokenHash(tokenHash: string, now: number): Promise<Session | undefined> {
    if (
      this.session === undefined ||
      this.session.tokenHash !== tokenHash ||
      this.session.revokedAt !== null ||
      this.session.expiresAt <= now
    ) {
      return undefined;
    }
    this.session = { ...this.session, lastUsedAt: now };
    return this.session;
  }

  public async revoke(sessionId: string, revokedAt: number): Promise<boolean> {
    if (this.session?.id !== sessionId || this.session.revokedAt !== null) return false;
    this.session = { ...this.session, revokedAt };
    return true;
  }
}

function createService(
  options: {
    readonly account?: Account;
    readonly now?: number;
    readonly passwordMatches?: boolean;
    readonly repository?: FakeSessionRepository;
  } = {},
): {
  service: SessionService;
  repository: FakeSessionRepository;
  verifiedHashes: string[];
} {
  const repository = options.repository ?? new FakeSessionRepository();
  const verifiedHashes: string[] = [];
  const accountReader: AccountCredentialReader = {
    findByEmail: async () => options.account,
    findById: async (accountId) =>
      accountId === options.account?.id ? options.account : undefined,
  };
  const passwordHasher: PasswordHasher = {
    hash: async () => "unused",
    verify: async (passwordHash) => {
      verifiedHashes.push(passwordHash);
      return options.passwordMatches ?? true;
    },
  };
  const tokenGenerator: SessionTokenGenerator = {
    create: () => ({ value: "galaxis_session_test", hash: "token-hash" }),
    hash: () => "token-hash",
  };

  return {
    repository,
    verifiedHashes,
    service: new SessionService({
      accountReader,
      passwordHasher,
      sessionRepository: repository,
      tokenGenerator,
      idGenerator: new FakeIdGenerator(),
      wallClock: new FakeWallClock(options.now ?? Date.UTC(2026, 0, 2)),
      sessionLifetimeMs: 7 * 24 * 60 * 60 * 1000,
      dummyPasswordHash: "dummy-password-hash",
    }),
  };
}

describe("session service", () => {
  it("creates a session with an opaque token and stores only its hash", async () => {
    const { service, repository } = createService({ account });

    const result = await service.create({
      email: " CAPTAIN@example.test ",
      password: "correct horse battery staple",
    });

    expect(result).toMatchObject({
      sessionId: "ses_fake_0001",
      accountId: account.id,
      email: account.email,
      token: "galaxis_session_test",
      expiresAt: "2026-01-09T00:00:00.000Z",
    });
    expect(repository.session).toMatchObject({ tokenHash: "token-hash" });
    expect(JSON.stringify(repository.session)).not.toContain("galaxis_session_test");
  });

  it("uses the dummy hash for an unknown account and returns one generic error", async () => {
    const { service, verifiedHashes } = createService();

    await expect(
      service.create({ email: "unknown@example.test", password: "secret" }),
    ).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
      message: "Die Zugangsdaten konnten nicht bestätigt werden.",
      retryable: false,
    });
    expect(verifiedHashes).toEqual(["dummy-password-hash"]);
  });

  it("rejects an expired session and revokes an active session", async () => {
    const { service } = createService({ account });
    await service.create({ email: account.email, password: "secret" });

    await expect(service.current("galaxis_session_test")).resolves.toMatchObject({
      sessionId: "ses_fake_0001",
    });
    await service.revoke("galaxis_session_test");
    await expect(service.current("galaxis_session_test")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("rejects an expired session through the repository boundary", async () => {
    const { service, repository } = createService({ account, now: 0 });
    await service.create({ email: account.email, password: "secret" });
    repository.session = { ...repository.session!, expiresAt: 1 };

    const laterService = createService({ account, now: 2, repository }).service;
    await expect(laterService.current("galaxis_session_test")).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });
});

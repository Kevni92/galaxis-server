// Feature: GAL-AUTH-SESSION-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { ApplicationError } from "../errors.js";
import type { WallClock } from "../runtime/clock.js";
import type { IdGenerator } from "../runtime/ids.js";
import type { AccountCredentialReader } from "../accounts/ports.js";
import type { Session } from "../../domain/sessions/session.js";
import { normalizeAccountEmail } from "../../domain/accounts/account.js";
import type { SessionRateLimiter, SessionRepository, SessionTokenGenerator } from "./ports.js";
import type { PasswordHasher } from "../accounts/ports.js";

export interface SessionCredentialsRequest {
  readonly email: string;
  readonly password: string;
  readonly rateLimitKey?: string;
}

export interface SessionCreatedResponse {
  readonly sessionId: string;
  readonly accountId: string;
  readonly email: string;
  readonly token: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface SessionResponse {
  readonly sessionId: string;
  readonly accountId: string;
  readonly email: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface AuthenticatedIdentity {
  readonly sessionId: string;
  readonly accountId: string;
  readonly email: string;
}

export interface SessionServiceDependencies {
  readonly accountReader: AccountCredentialReader;
  readonly passwordHasher: PasswordHasher;
  readonly sessionRepository: SessionRepository;
  readonly tokenGenerator: SessionTokenGenerator;
  readonly idGenerator: IdGenerator;
  readonly wallClock: WallClock;
  readonly sessionLifetimeMs: number;
  readonly dummyPasswordHash: string;
  readonly rateLimiter?: SessionRateLimiter;
}

const authenticationFailedMessage = "Die Zugangsdaten konnten nicht bestätigt werden.";
const sessionInvalidMessage = "Es ist keine gültige Session vorhanden.";
const rateLimitedMessage = "Zu viele Anfragen; bitte später erneut versuchen.";

function authenticationFailed(): ApplicationError {
  return new ApplicationError("AUTHENTICATION_FAILED", authenticationFailedMessage, {
    retryable: false,
  });
}

function sessionInvalid(): ApplicationError {
  return new ApplicationError("SESSION_INVALID", sessionInvalidMessage, { retryable: false });
}

function rateLimited(): ApplicationError {
  return new ApplicationError("RATE_LIMITED", rateLimitedMessage, { retryable: true });
}

function toInstant(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function publicSession(session: Session, email: string): SessionResponse {
  return {
    sessionId: session.id,
    accountId: session.accountId,
    email,
    createdAt: toInstant(session.createdAt),
    expiresAt: toInstant(session.expiresAt),
  };
}

export class SessionService {
  private readonly accountReader: AccountCredentialReader;
  private readonly passwordHasher: PasswordHasher;
  private readonly sessionRepository: SessionRepository;
  private readonly tokenGenerator: SessionTokenGenerator;
  private readonly idGenerator: IdGenerator;
  private readonly wallClock: WallClock;
  private readonly sessionLifetimeMs: number;
  private readonly dummyPasswordHash: string;
  private readonly rateLimiter: SessionRateLimiter | undefined;

  public constructor(dependencies: SessionServiceDependencies) {
    if (!Number.isInteger(dependencies.sessionLifetimeMs) || dependencies.sessionLifetimeMs < 1) {
      throw new RangeError("sessionLifetimeMs must be a positive integer");
    }

    this.accountReader = dependencies.accountReader;
    this.passwordHasher = dependencies.passwordHasher;
    this.sessionRepository = dependencies.sessionRepository;
    this.tokenGenerator = dependencies.tokenGenerator;
    this.idGenerator = dependencies.idGenerator;
    this.wallClock = dependencies.wallClock;
    this.sessionLifetimeMs = dependencies.sessionLifetimeMs;
    this.dummyPasswordHash = dependencies.dummyPasswordHash;
    this.rateLimiter = dependencies.rateLimiter;
  }

  public async create(request: SessionCredentialsRequest): Promise<SessionCreatedResponse> {
    const normalizedEmail = normalizeAccountEmail(request.email);
    const lookupEmail = normalizedEmail ?? request.email.trim().toLowerCase();
    const rateLimitKey = request.rateLimitKey ?? lookupEmail;
    if (this.rateLimiter !== undefined && !(await this.rateLimiter.allow(rateLimitKey))) {
      throw rateLimited();
    }

    const account =
      normalizedEmail === undefined
        ? undefined
        : await this.accountReader.findByEmail(normalizedEmail);
    const passwordHash = account?.passwordHash ?? this.dummyPasswordHash;
    const passwordMatches = await this.passwordHasher.verify(passwordHash, request.password);
    if (account === undefined || !passwordMatches) throw authenticationFailed();

    const createdAt = this.wallClock.now();
    const token = this.tokenGenerator.create();
    const session: Session = {
      id: this.idGenerator.next("ses"),
      accountId: account.id,
      tokenHash: token.hash,
      createdAt,
      expiresAt: createdAt + this.sessionLifetimeMs,
      lastUsedAt: null,
      revokedAt: null,
    };
    await this.sessionRepository.create(session);

    return {
      ...publicSession(session, account.email),
      token: token.value,
    };
  }

  public async authenticate(token: string): Promise<AuthenticatedIdentity> {
    const session = await this.findActive(token);
    return {
      sessionId: session.id,
      accountId: session.accountId,
      email: await this.emailForSession(session),
    };
  }

  public async current(token: string): Promise<SessionResponse> {
    const session = await this.findActive(token);
    return publicSession(session, await this.emailForSession(session));
  }

  public async revoke(token: string): Promise<void> {
    const session = await this.findActive(token);
    if (!(await this.sessionRepository.revoke(session.id, this.wallClock.now()))) {
      throw sessionInvalid();
    }
  }

  private async findActive(token: string): Promise<Session> {
    if (token.length === 0) throw sessionInvalid();
    const session = await this.sessionRepository.findActiveByTokenHash(
      this.tokenGenerator.hash(token),
      this.wallClock.now(),
    );
    if (session === undefined) throw sessionInvalid();
    return session;
  }

  private async emailForSession(session: Session): Promise<string> {
    const account = await this.accountReader.findById(session.accountId);
    if (account === undefined) throw sessionInvalid();
    return account.email;
  }
}

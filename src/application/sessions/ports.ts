// Feature: GAL-AUTH-SESSION-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import type { Session } from "../../domain/sessions/session.js";

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findActiveByTokenHash(tokenHash: string, now: number): Promise<Session | undefined>;
  revoke(sessionId: string, revokedAt: number): Promise<boolean>;
}

export interface SessionToken {
  readonly value: string;
  readonly hash: string;
}

export interface SessionTokenGenerator {
  create(): SessionToken;
  hash(value: string): string;
}

export interface SessionRateLimiter {
  allow(key: string): Promise<boolean>;
}

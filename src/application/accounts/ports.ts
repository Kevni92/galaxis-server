// Feature: GAL-AUTH-ACCOUNT-001
// Fachliche Grundlage: docs/contracts/rest-api/galaxis-rest-v1.yaml

import type { Account } from "../../domain/accounts/account.js";

export interface AccountRepository {
  /** Returns false for an already registered normalized identifier. */
  create(account: Account): Promise<boolean>;
}

export interface AccountCredentialReader {
  findByEmail(email: string): Promise<Account | undefined>;
  findById(accountId: string): Promise<Account | undefined>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export interface RegistrationRateLimiter {
  allow(key: string): Promise<boolean>;
}

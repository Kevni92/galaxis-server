// Feature: GAL-AUTH-ACCOUNT-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

import { ApplicationError } from "../errors.js";
import type { WallClock } from "../runtime/clock.js";
import type { IdGenerator } from "../runtime/ids.js";
import { normalizeAccountEmail, type Account } from "../../domain/accounts/account.js";
import type { AccountRepository, PasswordHasher, RegistrationRateLimiter } from "./ports.js";

export interface AccountRegistrationRequest {
  readonly email: string;
  readonly password: string;
  readonly rateLimitKey?: string;
}

export interface AccountRegistrationResponse {
  readonly accountId: string;
  readonly email: string;
  readonly createdAt: string;
}

export interface AccountRegistrationDependencies {
  readonly repository: AccountRepository;
  readonly passwordHasher: PasswordHasher;
  readonly idGenerator: IdGenerator;
  readonly wallClock: WallClock;
  readonly rateLimiter?: RegistrationRateLimiter;
}

const rejectionMessage = "Die Registrierung konnte nicht abgeschlossen werden.";
const rateLimitedMessage = "Zu viele Anfragen; bitte später erneut versuchen.";

function registrationRejected(
  details?: readonly { field: string; reason: string }[],
): ApplicationError {
  return new ApplicationError("ACCOUNT_REGISTRATION_REJECTED", rejectionMessage, {
    ...(details === undefined ? {} : { details }),
    retryable: false,
  });
}

export class AccountRegistrationService {
  private readonly repository: AccountRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly idGenerator: IdGenerator;
  private readonly wallClock: WallClock;
  private readonly rateLimiter: RegistrationRateLimiter | undefined;

  public constructor(dependencies: AccountRegistrationDependencies) {
    this.repository = dependencies.repository;
    this.passwordHasher = dependencies.passwordHasher;
    this.idGenerator = dependencies.idGenerator;
    this.wallClock = dependencies.wallClock;
    this.rateLimiter = dependencies.rateLimiter;
  }

  public async register(request: AccountRegistrationRequest): Promise<AccountRegistrationResponse> {
    const email = normalizeAccountEmail(request.email);
    if (email === undefined) {
      throw registrationRejected([{ field: "email", reason: "INVALID_FORMAT" }]);
    }
    if (request.password.length === 0) {
      throw registrationRejected([{ field: "password", reason: "REQUIRED" }]);
    }
    if (
      this.rateLimiter !== undefined &&
      !(await this.rateLimiter.allow(request.rateLimitKey ?? email))
    ) {
      throw new ApplicationError("RATE_LIMITED", rateLimitedMessage, { retryable: true });
    }

    const account: Account = {
      id: this.idGenerator.next("acc"),
      email,
      passwordHash: await this.passwordHasher.hash(request.password),
      createdAt: this.wallClock.now(),
    };

    if (!(await this.repository.create(account))) {
      throw registrationRejected();
    }

    return {
      accountId: account.id,
      email: account.email,
      createdAt: new Date(account.createdAt).toISOString(),
    };
  }
}

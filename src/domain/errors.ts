export interface ErrorDetail {
  readonly field: string;
  readonly reason: string;
}

export interface GalaxisErrorOptions {
  readonly details?: readonly ErrorDetail[];
  readonly retryable?: boolean;
}

export class DomainError extends Error {
  public readonly code: string;
  public readonly details: readonly ErrorDetail[] | undefined;
  public readonly retryable: boolean;

  public constructor(code: string, message: string, options: GalaxisErrorOptions = {}) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }
}

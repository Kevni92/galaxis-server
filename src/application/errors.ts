import { DomainError, type GalaxisErrorOptions } from "../domain/errors.js";

export class ApplicationError extends DomainError {
  public constructor(code: string, message: string, options: GalaxisErrorOptions = {}) {
    super(code, message, options);
    this.name = "ApplicationError";
  }
}

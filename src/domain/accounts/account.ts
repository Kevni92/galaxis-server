// Feature: GAL-AUTH-ACCOUNT-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: number;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** Returns the canonical login identifier or undefined when it is not an email address. */
export function normalizeAccountEmail(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  return emailPattern.test(normalized) ? normalized : undefined;
}

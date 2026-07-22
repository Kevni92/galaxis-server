// Feature: GAL-AUTH-SESSION-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1.yaml

export interface Session {
  readonly id: string;
  readonly accountId: string;
  readonly tokenHash: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly lastUsedAt: number | null;
  readonly revokedAt: number | null;
}

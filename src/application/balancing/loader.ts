// Feature: GAL-BAL-DATA-001
// Fachliche Grundlage: docs/balancing/data-format.md
// Architekturentscheidung: docs/decisions/0004-versionierte-balancing-schicht.md

export type BalancingStatus = "draft" | "baseline" | "validated" | "release" | "replaced";

export interface BalancingParameter {
  readonly value: number;
  readonly unit: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly description?: string;
  readonly sourceSection?: string;
  readonly references?: readonly string[];
  readonly fallbackReference?: string;
  readonly enabled?: boolean;
}

export interface BalancingDocument {
  readonly schemaVersion: string;
  readonly balancingVersion: string;
  readonly catalogVersion: string;
  readonly status: BalancingStatus;
  readonly effectiveFrom: string;
  readonly sources: readonly string[];
  readonly units: readonly string[];
  readonly parameters: Readonly<Record<string, BalancingParameter>>;
}

export type LoadedBalancingConfiguration = Readonly<BalancingDocument & { readonly hash: string }>;

/** Node-free port used by Application and Domain code to obtain fixed balancing data. */
export interface BalancingLoader {
  load(): Promise<LoadedBalancingConfiguration>;
}

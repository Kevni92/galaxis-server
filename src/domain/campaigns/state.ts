// Feature: GAL-PERSIST-A1-001
// Fachliche Grundlage: docs/decisions/0004-versionierte-balancing-schicht.md
// Fachliche Grundlage: docs/TESTING.md

import type { Campaign } from "./campaign.js";

/**
 * Erwartete Balancingidentität einer laufenden Kampagne. Eine laufende Kampagne
 * wechselt nicht unbemerkt auf neue Werte (Entscheidung 0004, Regel 5); Version und
 * kanonischer Hash müssen beim Laden mit dem Kampagnenkopf übereinstimmen.
 */
export interface BalancingIdentity {
  readonly balancingVersion: string;
  readonly catalogVersion: string;
  readonly hash: string;
}

export type LoadValidationIssue =
  | {
      readonly kind: "balancing_version_mismatch";
      readonly expected: string;
      readonly actual: string;
    }
  | {
      readonly kind: "catalog_version_mismatch";
      readonly expected: string;
      readonly actual: string;
    }
  | { readonly kind: "balancing_hash_mismatch"; readonly expected: string; readonly actual: string }
  | { readonly kind: "invalid_state_version"; readonly actual: number };

/**
 * Prüft eine geladene Kampagne gegen die aktuell geladene Balancingidentität. Fehlt
 * die Übereinstimmung, darf die Kampagne nicht stillschweigend weiterlaufen; der
 * Aufrufer lehnt inkompatible Daten kontrolliert ab.
 */
export function validateCampaignLoad(
  campaign: Campaign,
  balancing: BalancingIdentity,
): readonly LoadValidationIssue[] {
  const issues: LoadValidationIssue[] = [];
  if (!Number.isInteger(campaign.stateVersion) || campaign.stateVersion < 1) {
    issues.push({ kind: "invalid_state_version", actual: campaign.stateVersion });
  }
  if (campaign.balancingVersion !== balancing.balancingVersion) {
    issues.push({
      kind: "balancing_version_mismatch",
      expected: balancing.balancingVersion,
      actual: campaign.balancingVersion,
    });
  }
  if (campaign.catalogVersion !== balancing.catalogVersion) {
    issues.push({
      kind: "catalog_version_mismatch",
      expected: balancing.catalogVersion,
      actual: campaign.catalogVersion,
    });
  }
  if (campaign.balancingHash !== balancing.hash) {
    issues.push({
      kind: "balancing_hash_mismatch",
      expected: balancing.hash,
      actual: campaign.balancingHash,
    });
  }
  return issues;
}

/**
 * Nächste Zustandsversion einer erfolgreichen atomaren Änderung. Die Version steigt
 * genau um eins und nur, wenn die erwartete Ausgangsversion der aktuellen entspricht
 * (Optimistic Concurrency). Bei Abweichung liegt ein Nebenläufigkeitskonflikt vor.
 */
export function nextStateVersion(current: number, expected: number): number {
  if (!Number.isInteger(current) || current < 1) {
    throw new RangeError("current state version must be a positive integer");
  }
  if (!Number.isInteger(expected) || expected < 1) {
    throw new RangeError("expected state version must be a positive integer");
  }
  if (current !== expected) {
    throw new StateVersionConflictError(expected, current);
  }
  return current + 1;
}

/** Nebenläufigkeitskonflikt: die sichtbare Ausgangslage war überholt. */
export class StateVersionConflictError extends Error {
  public readonly expected: number;
  public readonly current: number;

  public constructor(expected: number, current: number) {
    super(`expected state version ${expected} but the campaign is at ${current}`);
    this.name = "StateVersionConflictError";
    this.expected = expected;
    this.current = current;
  }
}

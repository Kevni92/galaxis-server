// Feature: GAL-BAL-DATA-001
// Fachliche Grundlage: docs/balancing/data-format.md
// Architekturentscheidung: docs/decisions/0004-versionierte-balancing-schicht.md

import { createHash } from "node:crypto";

import type { BalancingDocument } from "../../application/balancing/loader.js";

function canonicalJsonValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Cannot canonicalize a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonValue).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonValue(record[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
}

/** Sorts object keys recursively while preserving array order and numeric values. */
export function canonicalJson(value: unknown): string {
  return canonicalJsonValue(value);
}

/** Hashes only validated source data; the computed hash is never part of its own input. */
export function balancingHash(document: BalancingDocument): string {
  return createHash("sha256").update(canonicalJson(document), "utf8").digest("hex");
}

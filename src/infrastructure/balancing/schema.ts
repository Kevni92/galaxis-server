// Feature: GAL-BAL-DATA-001
// Fachliche Grundlage: docs/balancing/data-format.md
// Architekturentscheidung: docs/decisions/0004-versionierte-balancing-schicht.md

import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import type {
  BalancingDocument,
  BalancingStatus,
  LoadedBalancingConfiguration,
} from "../../application/balancing/loader.js";
import { balancingHash } from "./canonical-hash.js";

const semverPattern = "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$";
const schemaVersionPattern = "^[0-9]+\\.[0-9]+$";
const identifierPattern = "^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$";
const unitPattern = "^[a-z][a-z0-9_]*$";

const statusSchema = Type.Union([
  Type.Literal("draft"),
  Type.Literal("baseline"),
  Type.Literal("validated"),
  Type.Literal("release"),
  Type.Literal("replaced"),
]);

const parameterSchema = Type.Object(
  {
    value: Type.Number(),
    unit: Type.String({ pattern: unitPattern, minLength: 1 }),
    minimum: Type.Optional(Type.Number()),
    maximum: Type.Optional(Type.Number()),
    description: Type.Optional(Type.String({ minLength: 1 })),
    sourceSection: Type.Optional(Type.String({ minLength: 1 })),
    references: Type.Optional(
      Type.Array(Type.String({ pattern: identifierPattern }), { uniqueItems: true }),
    ),
    fallbackReference: Type.Optional(Type.String({ pattern: identifierPattern })),
    enabled: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const balancingDocumentSchema = Type.Object(
  {
    schemaVersion: Type.String({ pattern: schemaVersionPattern }),
    balancingVersion: Type.String({ pattern: semverPattern }),
    catalogVersion: Type.String({ pattern: semverPattern }),
    status: statusSchema,
    effectiveFrom: Type.String({ minLength: 1 }),
    sources: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true }),
    units: Type.Array(Type.String({ pattern: unitPattern, minItems: 1 }), {
      minItems: 1,
      uniqueItems: true,
    }),
    parameters: Type.Record(Type.String({ pattern: identifierPattern }), parameterSchema),
  },
  { additionalProperties: false },
);

export type BalancingDocumentInput = Static<typeof balancingDocumentSchema>;

export interface BalancingValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
  readonly parameterId?: string;
}

export class BalancingValidationError extends Error {
  public readonly issues: readonly BalancingValidationIssue[];

  public constructor(issues: readonly BalancingValidationIssue[]) {
    super(`Invalid balancing configuration: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "BalancingValidationError";
    this.issues = issues;
  }
}

function schemaIssues(input: unknown): BalancingValidationIssue[] {
  return [...Value.Errors(balancingDocumentSchema, input)].map((error) => ({
    path: error.path || "/",
    code: "schema",
    message: `${error.path || "/"}: ${error.message}`,
  }));
}

function semanticIssues(document: BalancingDocument): BalancingValidationIssue[] {
  const issues: BalancingValidationIssue[] = [];
  const units = new Set(document.units);
  const parameters = document.parameters;

  if (document.schemaVersion !== "1.0") {
    issues.push({
      path: "/schemaVersion",
      code: "unsupported_schema_version",
      message: `/schemaVersion: unsupported schema version '${document.schemaVersion}'`,
    });
  }

  for (const [parameterId, parameter] of Object.entries(parameters)) {
    const path = `/parameters/${parameterId}`;
    if (!units.has(parameter.unit)) {
      issues.push({
        path: `${path}/unit`,
        code: "unknown_unit",
        message: `${path}/unit: unit '${parameter.unit}' is not registered`,
        parameterId,
      });
    }

    if (parameter.minimum !== undefined && !Number.isFinite(parameter.minimum)) {
      issues.push({
        path: `${path}/minimum`,
        code: "non_finite_number",
        message: `${path}/minimum: value must be finite`,
        parameterId,
      });
    }
    if (parameter.maximum !== undefined && !Number.isFinite(parameter.maximum)) {
      issues.push({
        path: `${path}/maximum`,
        code: "non_finite_number",
        message: `${path}/maximum: value must be finite`,
        parameterId,
      });
    }
    if (!Number.isFinite(parameter.value)) {
      issues.push({
        path: `${path}/value`,
        code: "non_finite_number",
        message: `${path}/value: value must be finite`,
        parameterId,
      });
    }
    if (parameter.minimum !== undefined && parameter.minimum < 0) {
      issues.push({
        path: `${path}/minimum`,
        code: "negative_boundary",
        message: `${path}/minimum: negative values are not allowed`,
        parameterId,
      });
    }
    if (parameter.maximum !== undefined && parameter.maximum < 0) {
      issues.push({
        path: `${path}/maximum`,
        code: "negative_boundary",
        message: `${path}/maximum: negative values are not allowed`,
        parameterId,
      });
    }
    if (
      parameter.minimum !== undefined &&
      parameter.maximum !== undefined &&
      parameter.minimum > parameter.maximum
    ) {
      issues.push({
        path,
        code: "invalid_range",
        message: `${path}: minimum must not exceed maximum`,
        parameterId,
      });
    }
    if (parameter.value < 0) {
      issues.push({
        path: `${path}/value`,
        code: "negative_value",
        message: `${path}/value: negative values are not allowed`,
        parameterId,
      });
    }
    if (parameter.minimum !== undefined && parameter.value < parameter.minimum) {
      issues.push({
        path: `${path}/value`,
        code: "below_minimum",
        message: `${path}/value: value is below minimum`,
        parameterId,
      });
    }
    if (parameter.maximum !== undefined && parameter.value > parameter.maximum) {
      issues.push({
        path: `${path}/value`,
        code: "above_maximum",
        message: `${path}/value: value exceeds maximum`,
        parameterId,
      });
    }

    for (const reference of parameter.references ?? []) {
      const target = parameters[reference];
      if (target === undefined) {
        issues.push({
          path: `${path}/references`,
          code: "unknown_reference",
          message: `${path}/references: target '${reference}' does not exist`,
          parameterId,
        });
        continue;
      }
      if (target.unit !== parameter.unit) {
        issues.push({
          path: `${path}/references`,
          code: "incompatible_reference_unit",
          message: `${path}/references: target '${reference}' uses unit '${target.unit}'`,
          parameterId,
        });
      }
      if (target.enabled === false && parameter.fallbackReference === undefined) {
        issues.push({
          path: `${path}/references`,
          code: "disabled_reference_without_fallback",
          message: `${path}/references: disabled target '${reference}' requires a fallback`,
          parameterId,
        });
      }
    }

    if (parameter.fallbackReference !== undefined) {
      const fallback = parameters[parameter.fallbackReference];
      if (fallback === undefined) {
        issues.push({
          path: `${path}/fallbackReference`,
          code: "unknown_fallback",
          message: `${path}/fallbackReference: target '${parameter.fallbackReference}' does not exist`,
          parameterId,
        });
      } else if (fallback.enabled === false || fallback.unit !== parameter.unit) {
        issues.push({
          path: `${path}/fallbackReference`,
          code: "invalid_fallback",
          message: `${path}/fallbackReference: fallback must be enabled and use the same unit`,
          parameterId,
        });
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const reportedCycles = new Set<string>();
  const visit = (parameterId: string, stack: readonly string[]): void => {
    if (visiting.has(parameterId)) {
      const cycleStart = stack.indexOf(parameterId);
      const cycle = [...stack.slice(cycleStart), parameterId].join(" -> ");
      if (!reportedCycles.has(cycle)) {
        reportedCycles.add(cycle);
        issues.push({
          path: `/parameters/${parameterId}/references`,
          code: "reference_cycle",
          message: `reference cycle detected: ${cycle}`,
          parameterId,
        });
      }
      return;
    }
    if (visited.has(parameterId)) return;

    visiting.add(parameterId);
    const parameter = parameters[parameterId];
    for (const reference of parameter?.references ?? []) {
      if (parameters[reference] !== undefined) visit(reference, [...stack, parameterId]);
    }
    visiting.delete(parameterId);
    visited.add(parameterId);
  };

  for (const parameterId of Object.keys(parameters)) visit(parameterId, []);
  return issues;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  const objectValue = value as object & Record<string, unknown>;
  for (const child of Object.values(objectValue)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function validateBalancingDocument(input: unknown): BalancingDocument {
  const structuralIssues = schemaIssues(input);
  if (structuralIssues.length > 0) throw new BalancingValidationError(structuralIssues);

  const document = input as BalancingDocument;
  const issues = semanticIssues(document);
  if (issues.length > 0) throw new BalancingValidationError(issues);
  return deepFreeze(document);
}

export function loadBalancingConfiguration(input: unknown): LoadedBalancingConfiguration {
  const document = validateBalancingDocument(input);
  return deepFreeze({ ...document, hash: balancingHash(document) });
}

export function isBalancingStatus(value: string): value is BalancingStatus {
  return ["draft", "baseline", "validated", "release", "replaced"].includes(value);
}

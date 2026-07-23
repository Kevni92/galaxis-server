// Feature: GAL-BAL-DATA-001
// Fachliche Grundlage: docs/balancing/data-format.md

import type { LoadedBalancingConfiguration } from "./loader.js";

export class MissingBalancingParameterError extends Error {
  public readonly parameterId: string;

  public constructor(parameterId: string, reason: string) {
    super(`Balancing parameter '${parameterId}' ${reason}`);
    this.name = "MissingBalancingParameterError";
    this.parameterId = parameterId;
  }
}

/**
 * Liest einen erforderlichen numerischen Balancingwert. Fehlt der Parameter oder trägt
 * er eine unerwartete Einheit, schlägt die Auswertung klar fehl, statt still auf einen
 * Nullwert auszuweichen (siehe data-format.md: kein stilles Ersetzen durch Nullwerte).
 */
export function requiredParameter(
  configuration: LoadedBalancingConfiguration,
  parameterId: string,
  expectedUnit: string,
): number {
  const parameter = configuration.parameters[parameterId];
  if (parameter === undefined) {
    throw new MissingBalancingParameterError(parameterId, "is not defined");
  }
  if (parameter.unit !== expectedUnit) {
    throw new MissingBalancingParameterError(
      parameterId,
      `must use unit '${expectedUnit}' but uses '${parameter.unit}'`,
    );
  }
  return parameter.value;
}

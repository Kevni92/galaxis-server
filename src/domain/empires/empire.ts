// Feature: GAL-EMPIRE-START-001
// Fachliche Grundlage: docs/docs/03-empires/reichsverwaltung.md
// Fachliche Grundlage: docs/docs/03-empires/controller-und-reichsuebernahme.md

export type EmpireStatus = "vorbereitet" | "aktiv";
export type ControllerType = "player" | "ai";

/**
 * Reichsentität mit stabiler Identität. Anzeigewerte sind änderbar, die ID bleibt
 * stabil (siehe reichsverwaltung.md). Der Wissenscontainer trennt bekanntes
 * Reichswissen strikt vom Controller und wird leer und kontrolliert initialisiert.
 */
export interface Empire {
  readonly id: string;
  readonly campaignId: string;
  readonly name: string;
  readonly status: EmpireStatus;
  readonly knowledge: EmpireKnowledge;
}

/**
 * Reichsspezifischer Wissenscontainer. Zu Beginn leer; künftige A1-Issues füllen
 * bekannte Systeme, Planeten und Ereignisse. Wissen bleibt vom Controller getrennt.
 */
export interface EmpireKnowledge {
  readonly knownSystemIds: readonly string[];
  readonly knownPlanetIds: readonly string[];
}

/**
 * Autoritative Controllerzuordnung. Ein Controllerwechsel ist niemals implizit;
 * Lesen und Befehlen sind getrennte Berechtigungen (siehe
 * controller-und-reichsuebernahme.md).
 */
export interface EmpireController {
  readonly empireId: string;
  readonly accountId: string;
  readonly controllerType: ControllerType;
  readonly canRead: boolean;
  readonly canControl: boolean;
}

export function emptyEmpireKnowledge(): EmpireKnowledge {
  return { knownSystemIds: [], knownPlanetIds: [] };
}

export function assertEmpireCreationValues(values: {
  readonly campaignId: string;
  readonly ownerAccountId: string;
  readonly name: string;
}): void {
  if (values.campaignId.trim().length === 0) {
    throw new RangeError("campaignId must not be empty");
  }
  if (values.ownerAccountId.trim().length === 0) {
    throw new RangeError("ownerAccountId must not be empty");
  }
  if (values.name.trim().length === 0) {
    throw new RangeError("empire name must not be empty");
  }
}

export function assertEmpireKnowledgeInitialized(knowledge: EmpireKnowledge): void {
  if (knowledge.knownSystemIds.length !== 0 || knowledge.knownPlanetIds.length !== 0) {
    throw new RangeError("empire knowledge container must be initialized empty");
  }
}

// Feature: GAL-COLONY-HOME-001
// Fachliche Grundlage: docs/docs/04-planets/planeten-und-kolonien.md
// Balancing: docs/balancing/domains/planets-and-colonies.md

import type { PlanetCategory, PlanetSize } from "../galaxy/galaxy.js";

/**
 * Lebenszyklus einer Kolonie (siehe planeten-und-kolonien.md). Die Heimatkolonie
 * startet als etablierte Kolonie: stabile eigene Verwaltung ohne Import- oder
 * Aufbauphase. Weitere Zustände entstehen erst in späteren A1-Issues.
 */
export type ColonyLifecycleState = "etabliert";

/**
 * Neutrale Startspezialisierung. Eine sichtbare strategische Spezialisierung wird
 * bewusst später gesetzt; sie darf keine verborgenen Produktionsregeln erzeugen.
 */
export type ColonySpecialization = "neutral";

/**
 * Persistierter Heimatplanet als fachliche Entität. Kategorie und Größe stammen
 * deterministisch aus der generierten Galaxie; die Zuordnung zu System und Reich
 * ist stabil (siehe planeten-und-kolonien.md).
 */
export interface HomePlanet {
  readonly id: string;
  readonly systemId: string;
  readonly campaignId: string;
  readonly ownerEmpireId: string;
  readonly category: PlanetCategory;
  readonly size: PlanetSize;
}

/**
 * Genau eine aktive Heimatkolonie je Startreich. Besitz und Controller ergeben
 * sich aus dem zugeordneten Reich; Wissen bleibt davon getrennt.
 */
export interface Colony {
  readonly id: string;
  readonly campaignId: string;
  readonly empireId: string;
  readonly planetId: string;
  readonly systemId: string;
  readonly isHomeColony: boolean;
  readonly lifecycleState: ColonyLifecycleState;
  readonly specialization: ColonySpecialization;
}

export interface HomeColonyValues {
  readonly campaignId: string;
  readonly empireId: string;
  readonly systemId: string;
  readonly planetId: string;
}

export function assertHomeColonyValues(values: HomeColonyValues): void {
  if (values.campaignId.trim().length === 0) {
    throw new RangeError("colony campaignId must not be empty");
  }
  if (values.empireId.trim().length === 0) {
    throw new RangeError("colony empireId must not be empty");
  }
  if (values.systemId.trim().length === 0) {
    throw new RangeError("colony systemId must not be empty");
  }
  if (values.planetId.trim().length === 0) {
    throw new RangeError("colony planetId must not be empty");
  }
}

/**
 * Der Startzustand ist neutral und aktiv: genau eine etablierte Heimatkolonie
 * ohne Spezialisierung. Verletzungen zeigen eine inkonsistente Erstellung an.
 */
export function assertHomeColonyStartState(colony: Colony): void {
  if (!colony.isHomeColony) {
    throw new RangeError("start colony must be flagged as the home colony");
  }
  if (colony.lifecycleState !== "etabliert") {
    throw new RangeError("home colony must start as an established colony");
  }
  if (colony.specialization !== "neutral") {
    throw new RangeError("home colony must start without a specialization");
  }
}

/**
 * Besitz- und Wissenskonsistenz: der Heimatplanet gehört dem Reich, liegt im
 * Heimatsystem und trägt genau die Kolonie, die dasselbe Reich und System nennt.
 */
export function assertHomeColonyConsistency(colony: Colony, planet: HomePlanet): void {
  if (planet.ownerEmpireId !== colony.empireId) {
    throw new RangeError("home planet ownership must match the colony empire");
  }
  if (planet.campaignId !== colony.campaignId) {
    throw new RangeError("home planet campaign must match the colony campaign");
  }
  if (planet.systemId !== colony.systemId) {
    throw new RangeError("home planet system must match the colony system");
  }
  if (planet.id !== colony.planetId) {
    throw new RangeError("home colony must sit on the owned home planet");
  }
}

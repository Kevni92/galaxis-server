// Feature: GAL-GALAXY-GENERATE-001
// Fachliche Grundlage: docs/docs/02-galaxy/galaxiestruktur-und-generierung.md
// Architekturentscheidung: docs/decisions/0002-deterministische-graph-galaxie.md

import type { Galaxy, GalaxyGenerationProfile } from "../../domain/galaxy/galaxy.js";

export interface GalaxyGenerationInput {
  readonly seed: number;
  readonly generatorVersion: string;
  readonly profile: GalaxyGenerationProfile;
}

export interface GalaxyGenerationReport {
  readonly galaxy: Galaxy;
  readonly hash: string;
  readonly systemCount: number;
  readonly connectionCount: number;
  readonly homeSystemId: string;
  readonly homePlanetId: string;
}

export interface GalaxyGenerator {
  generate(input: GalaxyGenerationInput): GalaxyGenerationReport;
}

export interface GalaxyHasher {
  hash(canonicalGalaxy: string): string;
}

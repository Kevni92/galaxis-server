// Feature: GAL-GALAXY-GENERATE-001
// Fachliche Grundlage: docs/docs/02-galaxy/galaxiestruktur-und-generierung.md
// Architekturentscheidung: docs/decisions/0002-deterministische-graph-galaxie.md

export const GALAXY_GENERATOR_VERSION = "galaxy-generator-v1";

export interface GalaxyGenerationProfile {
  readonly id: string;
  readonly systemCount: number;
  readonly minimumStartConnections: number;
  readonly minimumPlanetsPerSystem: number;
  readonly maximumPlanetsPerSystem: number;
  readonly additionalConnectionCount: number;
}

export const SMALL_GALAXY_PROFILE: GalaxyGenerationProfile = Object.freeze({
  id: "small",
  systemCount: 8,
  minimumStartConnections: 3,
  minimumPlanetsPerSystem: 2,
  maximumPlanetsPerSystem: 4,
  additionalConnectionCount: 3,
});

export type PlanetCategory = "terrestrial" | "gas-giant" | "ice" | "barren";
export type PlanetSize = "small" | "medium" | "large";
export type StarClass = "red-dwarf" | "yellow" | "blue";

export interface GalaxyCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface GalaxyStar {
  readonly id: string;
  readonly starClass: StarClass;
}

export interface GalaxyPlanet {
  readonly id: string;
  readonly systemId: string;
  readonly category: PlanetCategory;
  readonly size: PlanetSize;
  readonly homeworldEligible: boolean;
}

export interface GalaxySystem {
  readonly id: string;
  readonly regionId: string;
  readonly coordinate: GalaxyCoordinate;
  readonly stars: readonly GalaxyStar[];
  readonly planets: readonly GalaxyPlanet[];
}

export interface GalaxyConnection {
  readonly id: string;
  readonly fromSystemId: string;
  readonly toSystemId: string;
  readonly type: "regular";
  readonly direction: "bidirectional";
  readonly distance: number;
}

export interface Galaxy {
  readonly seed: number;
  readonly generatorVersion: string;
  readonly randomAlgorithm: string;
  readonly profileId: string;
  readonly systems: readonly GalaxySystem[];
  readonly connections: readonly GalaxyConnection[];
  readonly startSystemId: string;
  readonly homePlanetId: string;
}

export function assertGalaxyGenerationProfile(profile: GalaxyGenerationProfile): void {
  if (!/^[a-z][a-z0-9-]*$/u.test(profile.id)) {
    throw new RangeError("profile.id must be a lowercase identifier");
  }
  if (!Number.isInteger(profile.systemCount) || profile.systemCount < 4) {
    throw new RangeError("profile.systemCount must be an integer of at least 4");
  }
  if (
    !Number.isInteger(profile.minimumStartConnections) ||
    profile.minimumStartConnections < 1 ||
    profile.minimumStartConnections >= profile.systemCount
  ) {
    throw new RangeError("profile.minimumStartConnections must fit the system count");
  }
  if (!Number.isInteger(profile.minimumPlanetsPerSystem) || profile.minimumPlanetsPerSystem < 1) {
    throw new RangeError("profile.minimumPlanetsPerSystem must be a positive integer");
  }
  if (
    !Number.isInteger(profile.maximumPlanetsPerSystem) ||
    profile.maximumPlanetsPerSystem < profile.minimumPlanetsPerSystem
  ) {
    throw new RangeError("profile.maximumPlanetsPerSystem must not be below the minimum");
  }

  const nonStartSystemCount = profile.systemCount - 1;
  const nonStartConnectionCapacity = (nonStartSystemCount * (nonStartSystemCount - 1)) / 2;
  const treeConnectionCount = profile.systemCount - 1 - profile.minimumStartConnections;
  const maximumAdditionalConnections = nonStartConnectionCapacity - treeConnectionCount;
  if (
    !Number.isInteger(profile.additionalConnectionCount) ||
    profile.additionalConnectionCount < 0 ||
    profile.additionalConnectionCount > maximumAdditionalConnections
  ) {
    throw new RangeError("profile.additionalConnectionCount exceeds graph capacity");
  }
}

export function assertGalaxyGenerationInput(input: {
  readonly seed: number;
  readonly generatorVersion: string;
  readonly profile: GalaxyGenerationProfile;
}): void {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0) {
    throw new RangeError("seed must be a non-negative safe integer");
  }
  if (input.generatorVersion.trim().length === 0) {
    throw new RangeError("generatorVersion must not be empty");
  }
  assertGalaxyGenerationProfile(input.profile);
}

export function canonicalGalaxyJson(galaxy: Galaxy): string {
  return JSON.stringify({
    seed: galaxy.seed,
    generatorVersion: galaxy.generatorVersion,
    randomAlgorithm: galaxy.randomAlgorithm,
    profileId: galaxy.profileId,
    startSystemId: galaxy.startSystemId,
    homePlanetId: galaxy.homePlanetId,
    systems: galaxy.systems,
    connections: galaxy.connections,
  });
}

export function assertGalaxyInvariants(galaxy: Galaxy, profile: GalaxyGenerationProfile): void {
  assertGalaxyGenerationInput({
    seed: galaxy.seed,
    generatorVersion: galaxy.generatorVersion,
    profile,
  });
  if (galaxy.profileId !== profile.id) throw new RangeError("galaxy profile does not match");
  if (galaxy.randomAlgorithm.trim().length === 0) {
    throw new RangeError("galaxy.randomAlgorithm must not be empty");
  }
  if (galaxy.systems.length !== profile.systemCount) {
    throw new RangeError("galaxy has an unexpected system count");
  }

  const systems = new Map(galaxy.systems.map((system) => [system.id, system]));
  if (systems.size !== galaxy.systems.length)
    throw new RangeError("galaxy system IDs must be unique");
  if (!systems.has(galaxy.startSystemId)) throw new RangeError("galaxy start system is missing");

  const planets = new Map<string, GalaxyPlanet>();
  for (const system of galaxy.systems) {
    if (system.stars.length === 0) throw new RangeError("every system needs a star");
    if (
      system.planets.length < profile.minimumPlanetsPerSystem ||
      system.planets.length > profile.maximumPlanetsPerSystem
    ) {
      throw new RangeError("system planet count does not match the profile");
    }
    for (const planet of system.planets) {
      if (planet.systemId !== system.id || planets.has(planet.id)) {
        throw new RangeError("planet ownership or IDs are invalid");
      }
      planets.set(planet.id, planet);
    }
  }

  const homePlanet = planets.get(galaxy.homePlanetId);
  if (
    homePlanet === undefined ||
    homePlanet.systemId !== galaxy.startSystemId ||
    !homePlanet.homeworldEligible
  ) {
    throw new RangeError("galaxy home planet is not suitable");
  }

  const adjacency = new Map<string, Set<string>>();
  for (const system of galaxy.systems) adjacency.set(system.id, new Set());
  const connectionIds = new Set<string>();
  const connectionEndpoints = new Set<string>();
  for (const connection of galaxy.connections) {
    const endpointKey = `${connection.fromSystemId}:${connection.toSystemId}`;
    if (
      connection.fromSystemId >= connection.toSystemId ||
      !systems.has(connection.fromSystemId) ||
      !systems.has(connection.toSystemId) ||
      connectionIds.has(connection.id) ||
      connectionEndpoints.has(endpointKey) ||
      connection.fromSystemId === connection.toSystemId ||
      !Number.isSafeInteger(connection.distance) ||
      connection.distance <= 0
    ) {
      throw new RangeError("galaxy connections are invalid");
    }
    connectionIds.add(connection.id);
    connectionEndpoints.add(endpointKey);
    adjacency.get(connection.fromSystemId)?.add(connection.toSystemId);
    adjacency.get(connection.toSystemId)?.add(connection.fromSystemId);
  }

  const startNeighbors = adjacency.get(galaxy.startSystemId)?.size ?? 0;
  if (startNeighbors < profile.minimumStartConnections) {
    throw new RangeError("galaxy start system has too few connections");
  }

  const visited = new Set<string>([galaxy.startSystemId]);
  const queue = [galaxy.startSystemId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  if (visited.size !== galaxy.systems.length) throw new RangeError("galaxy graph is disconnected");
}

// Feature: GAL-GALAXY-GENERATE-001
// Fachliche Grundlage: docs/docs/02-galaxy/galaxiestruktur-und-generierung.md
// Architekturentscheidung: docs/decisions/0002-deterministische-graph-galaxie.md

import { createHash } from "node:crypto";

import type { RandomStream, RandomStreamFactory } from "../../application/runtime/random.js";
import type {
  GalaxyGenerationInput,
  GalaxyGenerationReport,
  GalaxyGenerator,
  GalaxyHasher,
} from "../../application/galaxy/ports.js";
import {
  assertGalaxyGenerationInput,
  assertGalaxyInvariants,
  canonicalGalaxyJson,
  type Galaxy,
  type GalaxyConnection,
  type GalaxyGenerationProfile,
  type GalaxyPlanet,
  type GalaxyStar,
  type GalaxySystem,
  type GalaxyCoordinate,
  type PlanetCategory,
  type PlanetSize,
  type StarClass,
} from "../../domain/galaxy/galaxy.js";
import { XorShift32RandomStream } from "../runtime/random.js";

const PLANET_CATEGORIES: readonly PlanetCategory[] = ["terrestrial", "gas-giant", "ice", "barren"];
const PLANET_SIZES: readonly PlanetSize[] = ["small", "medium", "large"];
const STAR_CLASSES: readonly StarClass[] = ["red-dwarf", "yellow", "blue"];

export class Sha256GalaxyHasher implements GalaxyHasher {
  public hash(canonicalGalaxy: string): string {
    return createHash("sha256").update(canonicalGalaxy, "utf8").digest("hex");
  }
}

export class XorShift32RandomStreamFactory implements RandomStreamFactory {
  public create(seed: number, streamId: string): RandomStream {
    return new XorShift32RandomStream(seed, streamId);
  }
}

export interface DeterministicGalaxyGeneratorDependencies {
  readonly randomStreamFactory?: RandomStreamFactory;
  readonly hasher?: GalaxyHasher;
}

function numberedId(prefix: string, index: number): string {
  return `${prefix}_${(index + 1).toString(10).padStart(4, "0")}`;
}

function randomItem<T>(random: RandomStream, values: readonly T[]): T {
  const value = values[random.nextInt(values.length)];
  if (value === undefined) throw new Error("random item selection failed");
  return value;
}

function coordinate(random: RandomStream, index: number): GalaxyCoordinate {
  return {
    x: index * 100 + random.nextInt(80),
    y: random.nextInt(800),
  };
}

function createStar(random: RandomStream, index: number): GalaxyStar {
  return {
    id: numberedId("star", index),
    starClass: randomItem(random, STAR_CLASSES),
    localPosition: { x: 0, y: 0 },
  };
}

function createPlanet(
  random: RandomStream,
  systemIndex: number,
  planetIndex: number,
): GalaxyPlanet {
  const homeworldEligible = systemIndex === 0 && planetIndex === 0;
  return {
    id: `planet_${(systemIndex + 1).toString(10).padStart(4, "0")}_${(planetIndex + 1).toString(10).padStart(2, "0")}`,
    systemId: numberedId("sys", systemIndex),
    category: homeworldEligible ? "terrestrial" : randomItem(random, PLANET_CATEGORIES),
    size: randomItem(random, PLANET_SIZES),
    homeworldEligible,
    localPosition: {
      x: (planetIndex + 1) * 120.5,
      y: planetIndex % 2 === 0 ? -44 : 44,
    },
  };
}

function createSystem(
  random: RandomStream,
  profile: GalaxyGenerationProfile,
  systemIndex: number,
): GalaxySystem {
  const planetCount =
    profile.minimumPlanetsPerSystem +
    random.nextInt(profile.maximumPlanetsPerSystem - profile.minimumPlanetsPerSystem + 1);
  const planets = Array.from({ length: planetCount }, (_, planetIndex) =>
    createPlanet(random, systemIndex, planetIndex),
  );
  return {
    id: numberedId("sys", systemIndex),
    regionId: numberedId("region", Math.floor(systemIndex / 4)),
    coordinate: coordinate(random, systemIndex),
    stars: [createStar(random, systemIndex)],
    planets,
  };
}

function connectionKey(fromIndex: number, toIndex: number): string {
  return `${fromIndex}:${toIndex}`;
}

function connectionId(fromIndex: number, toIndex: number): string {
  return `edge_${(fromIndex + 1).toString(10).padStart(4, "0")}_${(toIndex + 1).toString(10).padStart(4, "0")}`;
}

function createConnection(
  systems: readonly GalaxySystem[],
  fromIndex: number,
  toIndex: number,
): GalaxyConnection {
  const fromSystem = systems[fromIndex];
  const toSystem = systems[toIndex];
  if (fromSystem === undefined || toSystem === undefined) {
    throw new Error("connection endpoint is missing");
  }
  const distance =
    Math.abs(fromSystem.coordinate.x - toSystem.coordinate.x) +
    Math.abs(fromSystem.coordinate.y - toSystem.coordinate.y);
  return {
    id: connectionId(fromIndex, toIndex),
    fromSystemId: fromSystem.id,
    toSystemId: toSystem.id,
    type: "regular",
    direction: "bidirectional",
    distance: Math.max(1, distance),
  };
}

function createConnections(
  random: RandomStream,
  systems: readonly GalaxySystem[],
  profile: GalaxyGenerationProfile,
): readonly GalaxyConnection[] {
  const selected = new Set<string>();
  const connections: GalaxyConnection[] = [];
  const add = (fromIndex: number, toIndex: number): void => {
    const low = Math.min(fromIndex, toIndex);
    const high = Math.max(fromIndex, toIndex);
    const key = connectionKey(low, high);
    if (selected.has(key)) throw new Error("duplicate galaxy connection generated");
    selected.add(key);
    connections.push(createConnection(systems, low, high));
  };

  for (let index = 1; index <= profile.minimumStartConnections; index += 1) {
    add(0, index);
  }
  for (let index = profile.minimumStartConnections + 1; index < systems.length; index += 1) {
    const parent = 1 + random.nextInt(index - 1);
    add(parent, index);
  }

  const candidates: Array<readonly [number, number]> = [];
  for (let fromIndex = 1; fromIndex < systems.length; fromIndex += 1) {
    for (let toIndex = fromIndex + 1; toIndex < systems.length; toIndex += 1) {
      if (!selected.has(connectionKey(fromIndex, toIndex))) {
        candidates.push([fromIndex, toIndex]);
      }
    }
  }
  for (let count = 0; count < profile.additionalConnectionCount; count += 1) {
    const candidateIndex = random.nextInt(candidates.length);
    const candidate = candidates.splice(candidateIndex, 1)[0];
    if (candidate === undefined) throw new Error("galaxy connection capacity exhausted");
    add(candidate[0], candidate[1]);
  }
  return connections;
}

export class DeterministicGalaxyGenerator implements GalaxyGenerator {
  private readonly randomStreamFactory: RandomStreamFactory;
  private readonly hasher: GalaxyHasher;

  public constructor(dependencies: DeterministicGalaxyGeneratorDependencies = {}) {
    this.randomStreamFactory =
      dependencies.randomStreamFactory ?? new XorShift32RandomStreamFactory();
    this.hasher = dependencies.hasher ?? new Sha256GalaxyHasher();
  }

  public generate(input: GalaxyGenerationInput): GalaxyGenerationReport {
    assertGalaxyGenerationInput(input);
    const random = this.randomStreamFactory.create(input.seed, "galaxy");
    const systems = Array.from({ length: input.profile.systemCount }, (_, index) =>
      createSystem(random, input.profile, index),
    );
    const galaxy: Galaxy = {
      seed: input.seed,
      generatorVersion: input.generatorVersion,
      randomAlgorithm: random.algorithm,
      profileId: input.profile.id,
      systems,
      connections: createConnections(random, systems, input.profile),
      startSystemId: numberedId("sys", 0),
      homePlanetId: "planet_0001_01",
    };

    assertGalaxyInvariants(galaxy, input.profile);
    return {
      galaxy,
      hash: this.hasher.hash(canonicalGalaxyJson(galaxy)),
      systemCount: galaxy.systems.length,
      connectionCount: galaxy.connections.length,
      homeSystemId: galaxy.startSystemId,
      homePlanetId: galaxy.homePlanetId,
    };
  }
}

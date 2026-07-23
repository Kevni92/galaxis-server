import { describe, expect, it } from "vitest";

import { GALAXY_GENERATOR_VERSION, SMALL_GALAXY_PROFILE } from "../../src/domain/galaxy/galaxy.js";
import { DeterministicGalaxyGenerator } from "../../src/infrastructure/galaxy/generator.js";

const generator = new DeterministicGalaxyGenerator();

function generate(seed: number) {
  return generator.generate({
    seed,
    generatorVersion: GALAXY_GENERATOR_VERSION,
    profile: SMALL_GALAXY_PROFILE,
  });
}

describe("DeterministicGalaxyGenerator", () => {
  it("repeats the complete start galaxy and hash for the same input", () => {
    const first = generate(42);
    const second = generate(42);

    expect(second).toEqual(first);
    expect(first.systemCount).toBe(SMALL_GALAXY_PROFILE.systemCount);
    expect(first.connectionCount).toBeGreaterThanOrEqual(SMALL_GALAXY_PROFILE.systemCount - 1);
  });

  it("creates a connected graph with a suitable home planet and three start exits", () => {
    for (const seed of [0, 1, 7, 42, 99]) {
      const report = generate(seed);
      const { galaxy } = report;
      const startNeighbors = new Set<string>();

      for (const connection of galaxy.connections) {
        if (connection.fromSystemId === galaxy.startSystemId) {
          startNeighbors.add(connection.toSystemId);
        } else if (connection.toSystemId === galaxy.startSystemId) {
          startNeighbors.add(connection.fromSystemId);
        }
      }

      const homePlanet = galaxy.systems
        .flatMap((system) => system.planets)
        .find((planet) => planet.id === galaxy.homePlanetId);
      expect(startNeighbors.size).toBeGreaterThanOrEqual(3);
      expect(homePlanet).toMatchObject({
        systemId: galaxy.startSystemId,
        homeworldEligible: true,
        category: "terrestrial",
      });
    }
  });

  it("changes the generated hash when the seed changes", () => {
    expect(generate(42).hash).not.toBe(generate(43).hash);
  });

  it("rejects an invalid profile before generating any graph", () => {
    expect(() =>
      generator.generate({
        seed: 42,
        generatorVersion: GALAXY_GENERATOR_VERSION,
        profile: { ...SMALL_GALAXY_PROFILE, systemCount: 3 },
      }),
    ).toThrow(/systemCount/u);
  });
});

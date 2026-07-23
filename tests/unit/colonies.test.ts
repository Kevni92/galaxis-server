import { describe, expect, it } from "vitest";

import {
  assertHomeColonyConsistency,
  assertHomeColonyStartState,
  assertHomeColonyValues,
  type Colony,
  type HomePlanet,
} from "../../src/domain/colonies/colony.js";

const colony: Colony = {
  id: "col_1",
  campaignId: "cmp_1",
  empireId: "emp_1",
  planetId: "pln_1",
  systemId: "sys_1",
  isHomeColony: true,
  lifecycleState: "etabliert",
  specialization: "neutral",
};

const planet: HomePlanet = {
  id: "pln_1",
  systemId: "sys_1",
  campaignId: "cmp_1",
  ownerEmpireId: "emp_1",
  category: "terrestrial",
  size: "medium",
};

describe("home colony domain invariants", () => {
  it("accepts a fully populated home colony", () => {
    expect(() => assertHomeColonyValues(colony)).not.toThrow();
    expect(() => assertHomeColonyStartState(colony)).not.toThrow();
    expect(() => assertHomeColonyConsistency(colony, planet)).not.toThrow();
  });

  it.each([
    { ...colony, campaignId: " " },
    { ...colony, empireId: "" },
    { ...colony, systemId: "   " },
    { ...colony, planetId: "" },
  ])("rejects missing identity values %o", (invalid) => {
    expect(() => assertHomeColonyValues(invalid)).toThrow(RangeError);
  });

  it("requires the start colony to be an active, unspecialized home colony", () => {
    expect(() => assertHomeColonyStartState({ ...colony, isHomeColony: false })).toThrow(
      RangeError,
    );
  });

  it.each([
    { ...planet, ownerEmpireId: "emp_other" },
    { ...planet, campaignId: "cmp_other" },
    { ...planet, systemId: "sys_other" },
    { ...planet, id: "pln_other" },
  ])("rejects an inconsistent planet %o", (invalidPlanet) => {
    expect(() => assertHomeColonyConsistency(colony, invalidPlanet)).toThrow(RangeError);
  });
});

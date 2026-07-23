import { describe, expect, it } from "vitest";

import {
  assertEmpireCreationValues,
  assertEmpireKnowledgeInitialized,
  emptyEmpireKnowledge,
} from "../../src/domain/empires/empire.js";

describe("empire domain invariants", () => {
  it("accepts a valid campaign, owner, and name", () => {
    expect(() =>
      assertEmpireCreationValues({
        campaignId: "cmp_1",
        ownerAccountId: "acc_1",
        name: "Startreich",
      }),
    ).not.toThrow();
  });

  it.each([
    { campaignId: "", ownerAccountId: "acc_1", name: "Startreich" },
    { campaignId: "cmp_1", ownerAccountId: "  ", name: "Startreich" },
    { campaignId: "cmp_1", ownerAccountId: "acc_1", name: "   " },
  ])("rejects invalid creation values %o", (values) => {
    expect(() => assertEmpireCreationValues(values)).toThrow(RangeError);
  });

  it("initializes the knowledge container empty", () => {
    const knowledge = emptyEmpireKnowledge();
    expect(knowledge).toEqual({ knownSystemIds: [], knownPlanetIds: [] });
    expect(() => assertEmpireKnowledgeInitialized(knowledge)).not.toThrow();
  });

  it("rejects a knowledge container that is not empty", () => {
    expect(() =>
      assertEmpireKnowledgeInitialized({ knownSystemIds: ["sys_1"], knownPlanetIds: [] }),
    ).toThrow(RangeError);
  });
});

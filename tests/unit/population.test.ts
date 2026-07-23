import { describe, expect, it } from "vitest";

import {
  assertEssentialSupplyStockConsistency,
  assertPopulationGroupConsistency,
  deriveEssentialSupplyStock,
  deriveStartPopulationGroup,
  type StartBaselineInputs,
} from "../../src/domain/population/start-baseline.js";

const identity = { id: "pop_1", campaignId: "cmp_1", colonyId: "col_1" } as const;
const stockIdentity = { id: "stk_1", campaignId: "cmp_1", colonyId: "col_1" } as const;

const inputs: StartBaselineInputs = {
  populationTotal: 1000,
  employableShareBasisPoints: 6000,
  employmentShareBasisPoints: 9400,
  essentialReserveDays: 7,
  essentialDailyConsumptionPerPop: 1000,
};

describe("start population baseline derivation", () => {
  it("derives nested workforce subsets without double counting", () => {
    const group = deriveStartPopulationGroup(identity, inputs);

    expect(group).toEqual({
      id: "pop_1",
      campaignId: "cmp_1",
      colonyId: "col_1",
      origin: "neutral",
      total: 1000,
      employable: 600,
      employed: 564,
    });
    expect(group.employable).toBeLessThanOrEqual(group.total);
    expect(group.employed).toBeLessThanOrEqual(group.employable);
  });

  it("floors derived subsets so rounding never creates population", () => {
    const group = deriveStartPopulationGroup(identity, {
      ...inputs,
      populationTotal: 999,
      employableShareBasisPoints: 3333,
    });

    // floor(999 * 3333 / 10000) = floor(332.9667) = 332, never rounded up.
    expect(group.employable).toBe(332);
    expect(group.employable).toBeLessThanOrEqual(group.total);
  });

  it("rejects a share above one hundred percent", () => {
    expect(() =>
      deriveStartPopulationGroup(identity, { ...inputs, employableShareBasisPoints: 10001 }),
    ).toThrow(RangeError);
  });

  it("rejects an empty start population", () => {
    expect(() => deriveStartPopulationGroup(identity, { ...inputs, populationTotal: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("essential supply stock derivation", () => {
  it("covers population times daily demand times reserve days without reservation", () => {
    const stock = deriveEssentialSupplyStock(stockIdentity, inputs);

    expect(stock).toEqual({
      id: "stk_1",
      campaignId: "cmp_1",
      colonyId: "col_1",
      quantity: 7_000_000,
      reserved: 0,
      coverageDays: 7,
    });
  });

  it("keeps the coverage consistent with the documented daily demand", () => {
    const dailyDemand = inputs.populationTotal * inputs.essentialDailyConsumptionPerPop;
    const stock = deriveEssentialSupplyStock(stockIdentity, inputs);

    expect(() => assertEssentialSupplyStockConsistency(stock, dailyDemand)).not.toThrow();
    expect(() =>
      assertEssentialSupplyStockConsistency({ ...stock, quantity: 1 }, dailyDemand),
    ).toThrow(RangeError);
  });
});

describe("baseline conservation invariants", () => {
  it("rejects employed exceeding employable", () => {
    expect(() =>
      assertPopulationGroupConsistency({
        id: "pop_1",
        campaignId: "cmp_1",
        colonyId: "col_1",
        origin: "neutral",
        total: 1000,
        employable: 600,
        employed: 601,
      }),
    ).toThrow(RangeError);
  });

  it("rejects reserved supply exceeding the available quantity", () => {
    expect(() =>
      assertEssentialSupplyStockConsistency(
        {
          id: "stk_1",
          campaignId: "cmp_1",
          colonyId: "col_1",
          quantity: 100,
          reserved: 101,
          coverageDays: 1,
        },
        100,
      ),
    ).toThrow(RangeError);
  });
});

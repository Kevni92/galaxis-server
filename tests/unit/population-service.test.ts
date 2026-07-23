import { describe, expect, it } from "vitest";

import { PopulationService } from "../../src/application/population/service.js";
import type {
  EmpireRepository,
  EmpireWithController,
} from "../../src/application/empires/ports.js";
import type {
  HomeColonyBaselineView,
  StartBaselineRepository,
} from "../../src/application/population/ports.js";

const readableEmpire: EmpireWithController = {
  empire: {
    id: "emp_1",
    campaignId: "cmp_1",
    name: "Startreich",
    status: "aktiv",
    knowledge: { knownSystemIds: ["sys_1"], knownPlanetIds: ["pln_1"] },
  },
  controller: {
    empireId: "emp_1",
    accountId: "acc_owner",
    controllerType: "player",
    canRead: true,
    canControl: true,
  },
};

const baseline: HomeColonyBaselineView = {
  colonyId: "col_1",
  systemId: "sys_1",
  populationGroup: {
    id: "pop_1",
    campaignId: "cmp_1",
    colonyId: "col_1",
    origin: "neutral",
    total: 1000,
    employable: 600,
    employed: 564,
  },
  essentialSupplyStock: {
    id: "stk_1",
    campaignId: "cmp_1",
    colonyId: "col_1",
    quantity: 7_000_000,
    reserved: 0,
    coverageDays: 7,
  },
};

class FakeEmpireRepository implements EmpireRepository {
  public constructor(private readonly empire: EmpireWithController | undefined) {}
  public async listReadableForAccount() {
    return this.empire === undefined ? [] : [this.empire];
  }
  public async findReadableForAccount() {
    return this.empire;
  }
}

class FakeBaselineRepository implements StartBaselineRepository {
  public constructor(private readonly view: HomeColonyBaselineView | undefined) {}
  public async findHomeColonyBaseline() {
    return this.view;
  }
}

function createService(
  empire: EmpireWithController | undefined = readableEmpire,
  view: HomeColonyBaselineView | undefined = baseline,
): PopulationService {
  return new PopulationService({
    empireRepository: new FakeEmpireRepository(empire),
    baselineRepository: new FakeBaselineRepository(view),
  });
}

describe("PopulationService", () => {
  it("summarizes the decision-relevant population figures", async () => {
    const summary = await createService().getPopulationSummary("acc_owner", "cmp_1", "emp_1");

    expect(summary).toEqual({
      campaignId: "cmp_1",
      empireId: "emp_1",
      colonyId: "col_1",
      systemId: "sys_1",
      totalPopulation: 1000,
      employablePopulation: 600,
      employedPopulation: 564,
      unemployedPopulation: 36,
      nonWorkforcePopulation: 400,
    });
  });

  it("summarizes the essential supply reserve and its available amount", async () => {
    const summary = await createService().getEconomySummary("acc_owner", "cmp_1", "emp_1");

    expect(summary.essentialSupply).toEqual({
      quantity: 7_000_000,
      reserved: 0,
      available: 7_000_000,
      coverageDays: 7,
    });
  });

  it("hides an empire the account may not read", async () => {
    const service = new PopulationService({
      empireRepository: new FakeEmpireRepository(undefined),
      baselineRepository: new FakeBaselineRepository(baseline),
    });

    await expect(service.getPopulationSummary("intruder", "cmp_1", "emp_1")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("hides an empire that belongs to a different campaign", async () => {
    await expect(
      createService().getEconomySummary("acc_owner", "cmp_other", "emp_1"),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("reports a missing baseline as a not-found resource", async () => {
    const service = new PopulationService({
      empireRepository: new FakeEmpireRepository(readableEmpire),
      baselineRepository: new FakeBaselineRepository(undefined),
    });

    await expect(service.getPopulationSummary("acc_owner", "cmp_1", "emp_1")).rejects.toMatchObject(
      { code: "RESOURCE_NOT_FOUND" },
    );
  });

  it("rejects an empty session identity", async () => {
    await expect(createService().getPopulationSummary("", "cmp_1", "emp_1")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

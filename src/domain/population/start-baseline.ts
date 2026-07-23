// Feature: GAL-POP-START-001
// Fachliche Grundlage: docs/docs/05-population/bevoelkerung-und-arbeit.md
// Fachliche Grundlage: docs/docs/06-economy/wirtschaft-und-versorgung.md
// Balancing: docs/balancing/domains/population-and-employment.md, docs/balancing/domains/economy-and-supply.md

/**
 * Neutrale Startspezies der Heimatbevölkerung. Eine differenzierte Speziesauswahl
 * entsteht erst später und darf keine verborgenen Produktionsregeln erzeugen.
 */
export type PopulationOrigin = "neutral";

/**
 * Aggregierte Startbevölkerung genau einer Gruppe je Heimatkolonie
 * (siehe bevoelkerung-und-arbeit.md). Einzelne Lebensläufe werden nicht simuliert;
 * geführt wird ein deterministisch ableitbares, mengenerhaltendes Erwerbspotenzial.
 */
export interface PopulationGroup {
  readonly id: string;
  readonly campaignId: string;
  readonly colonyId: string;
  readonly origin: PopulationOrigin;
  /** Gesamtbevölkerung in aggregierten Populationseinheiten. */
  readonly total: number;
  /** Erwerbsfähiger Anteil der Gesamtbevölkerung, nie größer als `total`. */
  readonly employable: number;
  /** Beschäftigter Anteil der erwerbsfähigen Bevölkerung, nie größer als `employable`. */
  readonly employed: number;
}

/**
 * Startbestand essentieller Grundversorgung einer Heimatkolonie. Der Bestand deckt
 * die dokumentierte Mindestreserve; er wird noch nicht verbraucht (keine A5/A6-Tick-
 * verarbeitung). Reservierte Mengen bleiben getrennt (siehe wirtschaft-und-versorgung.md).
 */
export interface EssentialSupplyStock {
  readonly id: string;
  readonly campaignId: string;
  readonly colonyId: string;
  /** Vorhandener Bestand in quantity_milliunits; nie negativ. */
  readonly quantity: number;
  /** Reservierter Anteil des Bestands; im Startzustand null. */
  readonly reserved: number;
  /** Abgedeckte Versorgungstage bei dokumentiertem Tagesbedarf. */
  readonly coverageDays: number;
}

/**
 * Deterministisch aus versionierten Balancingdaten abgeleitete Startwerte. Die
 * Anteile sind Basispunkte (10000 = 100 %); der Tagesbedarf gilt je Populationseinheit.
 */
export interface StartBaselineInputs {
  readonly populationTotal: number;
  readonly employableShareBasisPoints: number;
  readonly employmentShareBasisPoints: number;
  readonly essentialReserveDays: number;
  readonly essentialDailyConsumptionPerPop: number;
}

const BASIS_POINTS_SCALE = 10000;

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}

function assertShare(value: number, label: string): void {
  assertNonNegativeInteger(value, label);
  if (value > BASIS_POINTS_SCALE) {
    throw new RangeError(`${label} must not exceed ${BASIS_POINTS_SCALE} basis points`);
  }
}

/**
 * Wandelt einen Anteil in Basispunkten in eine ganzzahlige Menge um. Abgerundet, damit
 * abgeleitete Teilmengen niemals durch Rundung ihre Bezugsgröße überschreiten und keine
 * Bevölkerung entsteht (Mengenerhaltung, siehe bevoelkerung-und-arbeit.md).
 */
function applyShare(base: number, shareBasisPoints: number): number {
  return Math.floor((base * shareBasisPoints) / BASIS_POINTS_SCALE);
}

/**
 * Leitet die aggregierte Startbevölkerungsgruppe deterministisch aus den Balancingwerten
 * ab. Erwerbsfähige und Beschäftigte sind geschachtelte Teilmengen ohne Doppelzählung.
 */
export function deriveStartPopulationGroup(
  identity: { readonly id: string; readonly campaignId: string; readonly colonyId: string },
  inputs: StartBaselineInputs,
): PopulationGroup {
  assertNonNegativeInteger(inputs.populationTotal, "populationTotal");
  if (inputs.populationTotal < 1) {
    throw new RangeError("start population must be at least one population unit");
  }
  assertShare(inputs.employableShareBasisPoints, "employableShareBasisPoints");
  assertShare(inputs.employmentShareBasisPoints, "employmentShareBasisPoints");

  const employable = applyShare(inputs.populationTotal, inputs.employableShareBasisPoints);
  const employed = applyShare(employable, inputs.employmentShareBasisPoints);

  const group: PopulationGroup = {
    id: identity.id,
    campaignId: identity.campaignId,
    colonyId: identity.colonyId,
    origin: "neutral",
    total: inputs.populationTotal,
    employable,
    employed,
  };
  assertPopulationGroupConsistency(group);
  return group;
}

/**
 * Leitet den essentiellen Startbestand aus Bevölkerung, Tagesbedarf und Zielreserve ab.
 * Bestand = Bevölkerung × Tagesbedarf × Reservetage; der Startbestand ist nicht reserviert.
 */
export function deriveEssentialSupplyStock(
  identity: { readonly id: string; readonly campaignId: string; readonly colonyId: string },
  inputs: StartBaselineInputs,
): EssentialSupplyStock {
  assertNonNegativeInteger(inputs.populationTotal, "populationTotal");
  assertNonNegativeInteger(inputs.essentialReserveDays, "essentialReserveDays");
  assertNonNegativeInteger(
    inputs.essentialDailyConsumptionPerPop,
    "essentialDailyConsumptionPerPop",
  );

  const dailyDemand = inputs.populationTotal * inputs.essentialDailyConsumptionPerPop;
  const quantity = dailyDemand * inputs.essentialReserveDays;

  const stock: EssentialSupplyStock = {
    id: identity.id,
    campaignId: identity.campaignId,
    colonyId: identity.colonyId,
    quantity,
    reserved: 0,
    coverageDays: inputs.essentialReserveDays,
  };
  assertEssentialSupplyStockConsistency(stock, dailyDemand);
  return stock;
}

/**
 * Erhaltungs- und Einheitenregeln der Bevölkerungsgruppe: keine negative Menge, keine
 * durch Rundung erzeugte Bevölkerung, geschachtelte Teilmengen ohne Doppelzählung.
 */
export function assertPopulationGroupConsistency(group: PopulationGroup): void {
  assertNonNegativeInteger(group.total, "population total");
  assertNonNegativeInteger(group.employable, "employable population");
  assertNonNegativeInteger(group.employed, "employed population");
  if (group.employable > group.total) {
    throw new RangeError("employable population must not exceed the total population");
  }
  if (group.employed > group.employable) {
    throw new RangeError("employed population must not exceed the employable population");
  }
}

/**
 * Erhaltungs- und Einheitenregeln des Startbestands: kein negativer oder reservierter
 * Startbestand und eine Deckung, die zum dokumentierten Tagesbedarf passt.
 */
export function assertEssentialSupplyStockConsistency(
  stock: EssentialSupplyStock,
  dailyDemand: number,
): void {
  assertNonNegativeInteger(stock.quantity, "supply quantity");
  assertNonNegativeInteger(stock.reserved, "reserved supply");
  assertNonNegativeInteger(stock.coverageDays, "coverage days");
  if (stock.reserved > stock.quantity) {
    throw new RangeError("reserved supply must not exceed the available quantity");
  }
  const expected = dailyDemand * stock.coverageDays;
  if (stock.quantity !== expected) {
    throw new RangeError("supply quantity must equal daily demand times coverage days");
  }
}

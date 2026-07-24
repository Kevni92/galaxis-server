// Feature: GAL-API-A1-CONTRACT-001
// REST-Vertrag: docs/contracts/rest-api/galaxis-rest-v1-a1.yaml

import { Type, type TSchema } from "@sinclair/typebox";

function strictObject(properties: Record<string, TSchema>) {
  return Type.Object(properties, { additionalProperties: false });
}

export const linkMap = Type.Record(Type.String(), Type.String({ minLength: 1 }));
export const instant = Type.String({ format: "date-time" });
export const localPosition = strictObject({
  x: Type.Number({ format: "double" }),
  y: Type.Number({ format: "double" }),
});
export const knowledgeLevel = Type.String({ minLength: 1 });

const galaxyPosition = strictObject({
  x: Type.Number({ format: "double" }),
  y: Type.Number({ format: "double" }),
  z: Type.Number({ format: "double" }),
});

const controlledEmpire = strictObject({
  empireId: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  canControl: Type.Boolean(),
});

export const campaignStateResponse = strictObject({
  campaignId: Type.String({ minLength: 1 }),
  status: Type.Literal("running"),
  timeProfile: Type.String({ minLength: 1 }),
  campaignTimeMs: Type.Integer({ minimum: 0 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  generatedAt: instant,
  balancingVersion: Type.String({ minLength: 1 }),
  balancingHash: Type.String({ minLength: 1 }),
  controlledEmpire,
  links: linkMap,
});

const knownSystemSummary = strictObject({
  systemId: Type.String({ minLength: 1 }),
  regionId: Type.String({ minLength: 1 }),
  knowledgeLevel,
  displayNameKey: Type.String({ minLength: 1 }),
  galaxyPosition,
  renderKind: Type.String({ minLength: 1 }),
  starCount: Type.Integer({ minimum: 0 }),
  planetCount: Type.Integer({ minimum: 0 }),
  links: linkMap,
});

const knownConnection = strictObject({
  connectionId: Type.String({ minLength: 1 }),
  fromSystemId: Type.String({ minLength: 1 }),
  toSystemId: Type.String({ minLength: 1 }),
  distance: Type.Integer({ minimum: 1 }),
});

export const galaxyOverviewResponse = strictObject({
  campaignId: Type.String({ minLength: 1 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  generatedAt: instant,
  startSystemId: Type.String({ minLength: 1 }),
  knownSystems: Type.Array(knownSystemSummary),
  knownConnections: Type.Array(knownConnection),
});

const starObject = strictObject({
  starId: Type.String({ minLength: 1 }),
  objectType: Type.Literal("star"),
  systemId: Type.String({ minLength: 1 }),
  knowledgeLevel,
  displayNameKey: Type.String({ minLength: 1 }),
  localPosition,
  renderKind: Type.String({ minLength: 1 }),
  starClass: Type.String({ minLength: 1 }),
  links: linkMap,
});

const planetObject = strictObject({
  planetId: Type.String({ minLength: 1 }),
  objectType: Type.Literal("planet"),
  systemId: Type.String({ minLength: 1 }),
  knowledgeLevel,
  displayNameKey: Type.String({ minLength: 1 }),
  localPosition,
  renderKind: Type.String({ minLength: 1 }),
  category: Type.String({ minLength: 1 }),
  size: Type.String({ minLength: 1 }),
  homeworldEligible: Type.Boolean(),
  links: linkMap,
});

export const systemDetailResponse = strictObject({
  campaignId: Type.String({ minLength: 1 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  generatedAt: instant,
  systemId: Type.String({ minLength: 1 }),
  regionId: Type.String({ minLength: 1 }),
  knowledgeLevel,
  displayNameKey: Type.String({ minLength: 1 }),
  stars: Type.Array(starObject),
  planets: Type.Array(planetObject),
  links: linkMap,
});

const colonyPlanetSummary = strictObject({
  category: Type.String({ minLength: 1 }),
  size: Type.String({ minLength: 1 }),
  knowledgeLevel,
  displayNameKey: Type.String({ minLength: 1 }),
  renderKind: Type.String({ minLength: 1 }),
});

const colonySummary = strictObject({
  colonyId: Type.String({ minLength: 1 }),
  systemId: Type.String({ minLength: 1 }),
  planetId: Type.String({ minLength: 1 }),
  isHomeColony: Type.Boolean(),
  lifecycleState: Type.String({ minLength: 1 }),
  specialization: Type.String({ minLength: 1 }),
  planet: colonyPlanetSummary,
  links: linkMap,
});

export const colonyOverviewResponse = strictObject({
  campaignId: Type.String({ minLength: 1 }),
  empireId: Type.String({ minLength: 1 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  generatedAt: instant,
  colonies: Type.Array(colonySummary),
});

export const populationSummaryResponse = strictObject({
  campaignId: Type.String({ minLength: 1 }),
  empireId: Type.String({ minLength: 1 }),
  colonyId: Type.String({ minLength: 1 }),
  systemId: Type.String({ minLength: 1 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  generatedAt: instant,
  totalPopulation: Type.Integer({ minimum: 0 }),
  employablePopulation: Type.Integer({ minimum: 0 }),
  employedPopulation: Type.Integer({ minimum: 0 }),
  unemployedPopulation: Type.Integer({ minimum: 0 }),
  nonWorkforcePopulation: Type.Integer({ minimum: 0 }),
});

export const economySummaryResponse = strictObject({
  campaignId: Type.String({ minLength: 1 }),
  empireId: Type.String({ minLength: 1 }),
  colonyId: Type.String({ minLength: 1 }),
  systemId: Type.String({ minLength: 1 }),
  stateVersion: Type.Integer({ minimum: 1 }),
  generatedAt: instant,
  essentialSupply: strictObject({
    quantity: Type.Integer({ minimum: 0 }),
    reserved: Type.Integer({ minimum: 0 }),
    available: Type.Integer({ minimum: 0 }),
    coverageDays: Type.Integer({ minimum: 0 }),
  }),
});

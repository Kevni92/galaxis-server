// Feature: GAL-SCENARIO-A1-001
// Fachliche Grundlage: docs/balancing/scenarios/s01-startreich.md
// Fachliche Grundlage: docs/contracts/rest-api/galaxis-rest-v1.md

import { canonicalJson } from "../infrastructure/balancing/canonical-hash.js";
import { createHash } from "node:crypto";

export interface HttpResponse {
  readonly status: number;
  readonly json: unknown;
}

/** Minimaler HTTP-Zugriff, den sowohl der Integrationstest als auch das CLI erfüllen. */
export type HttpInvoke = (request: {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
  readonly token?: string;
  readonly headers?: Readonly<Record<string, string>>;
}) => Promise<HttpResponse>;

export interface A1ScenarioInput {
  readonly seed: number;
  readonly email: string;
  readonly password: string;
  readonly timeProfile?: string;
  readonly idempotencyKey: string;
}

export interface A1ScenarioResult {
  /** Fachlicher Hash der sichtbaren A1-Startlage; bei gleichem Seed reproduzierbar. */
  readonly digest: string;
  /** Sichtbare, normalisierte Startlage (opake IDs auf Platzhalter reduziert). */
  readonly normalizedState: unknown;
  readonly stateVersion: number;
}

export class A1ScenarioError extends Error {
  public readonly step: string;
  public readonly seed: number;

  public constructor(step: string, seed: number, detail: string) {
    super(`A1 scenario failed at step '${step}' (seed ${seed}): ${detail}`);
    this.name = "A1ScenarioError";
    this.step = step;
    this.seed = seed;
  }
}

function expectStatus(
  step: string,
  seed: number,
  response: HttpResponse,
  expected: number,
): unknown {
  if (response.status !== expected) {
    throw new A1ScenarioError(
      step,
      seed,
      `expected HTTP ${expected} but received ${response.status}: ${JSON.stringify(response.json)}`,
    );
  }
  return response.json;
}

function tokenFrom(step: string, seed: number, body: unknown): string {
  if (typeof body === "object" && body !== null && "token" in body) {
    const token = (body as { token: unknown }).token;
    if (typeof token === "string" && token.length > 0) return token;
  }
  throw new A1ScenarioError(step, seed, "session response did not contain a token");
}

function stringField(step: string, seed: number, body: unknown, field: string): string {
  if (typeof body === "object" && body !== null && field in body) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === "string" && value.length > 0) return value;
  }
  throw new A1ScenarioError(step, seed, `response is missing the '${field}' field`);
}

/**
 * Ersetzt opake, zufällige Ressourcen-IDs (Kampagne, Reich, Planet, Kolonie) durch
 * stabile Platzhalter, damit der fachliche Hash nur von der deterministischen Startlage
 * abhängt. Galaxie-interne IDs bleiben erhalten. Navigationslinks werden entfernt, weil
 * sie zufällige IDs in URLs einbetten und keine fachliche Aussage tragen.
 */
function normalizeIds(value: unknown, replacements: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => normalizeIds(item, replacements));
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === "links") continue;
      result[key] = normalizeIds(entry, replacements);
    }
    return result;
  }
  return value;
}

/**
 * Führt die vollständige A1-Demo über HTTP aus: Registrierung, Anmeldung, Kampagne,
 * bekannte Galaxie, Heimatsystem, Kolonien, Bevölkerung und Grundversorgung. Erzeugt
 * eine normalisierte Startlage und deren fachlichen Hash.
 */
export async function runA1Scenario(
  invoke: HttpInvoke,
  input: A1ScenarioInput,
): Promise<A1ScenarioResult> {
  const { seed } = input;
  const timeProfile = input.timeProfile ?? "standard";

  expectStatus(
    "register",
    seed,
    await invoke({
      method: "POST",
      path: "/api/v1/auth/accounts",
      body: { email: input.email, password: input.password },
    }),
    201,
  );

  const login = await invoke({
    method: "POST",
    path: "/api/v1/auth/sessions",
    body: { email: input.email, password: input.password },
  });
  const token = tokenFrom("login", seed, expectStatus("login", seed, login, 201));

  const created = expectStatus(
    "create-campaign",
    seed,
    await invoke({
      method: "POST",
      path: "/api/v1/campaigns",
      body: { seed, timeProfile },
      token,
      headers: { "idempotency-key": input.idempotencyKey },
    }),
    201,
  );
  const campaignId = stringField("create-campaign", seed, created, "campaignId");
  const campaignBase = `/api/v1/campaigns/${campaignId}`;

  const state = expectStatus(
    "campaign-state",
    seed,
    await invoke({ method: "GET", path: `${campaignBase}/state`, token }),
    200,
  );
  const empireId = stringField(
    "campaign-state",
    seed,
    (state as { controlledEmpire?: unknown }).controlledEmpire,
    "empireId",
  );
  const empireBase = `${campaignBase}/empires/${empireId}`;

  const galaxy = expectStatus(
    "galaxy",
    seed,
    await invoke({ method: "GET", path: `${campaignBase}/galaxy`, token }),
    200,
  );
  const homeSystemId = stringField("galaxy", seed, galaxy, "startSystemId");

  const system = expectStatus(
    "system-detail",
    seed,
    await invoke({ method: "GET", path: `${campaignBase}/systems/${homeSystemId}`, token }),
    200,
  );
  const colonies = expectStatus(
    "colonies",
    seed,
    await invoke({ method: "GET", path: `${empireBase}/colonies`, token }),
    200,
  );
  const population = expectStatus(
    "population",
    seed,
    await invoke({ method: "GET", path: `${empireBase}/population`, token }),
    200,
  );
  const economy = expectStatus(
    "economy",
    seed,
    await invoke({ method: "GET", path: `${empireBase}/economy`, token }),
    200,
  );

  const colonyId = firstColonyId(colonies);
  const planetId = firstColonyPlanetId(colonies);
  const replacements = new Map<string, string>([
    [campaignId, "cmp_demo"],
    [empireId, "emp_demo"],
    ...(colonyId === undefined ? [] : ([[colonyId, "col_demo"]] as [string, string][])),
    ...(planetId === undefined ? [] : ([[planetId, "pln_demo"]] as [string, string][])),
  ]);

  const stateVersion = numberField("campaign-state", seed, state, "stateVersion");
  const normalizedState = normalizeIds(
    { state, galaxy, system, colonies, population, economy },
    replacements,
  );

  return {
    digest: createHash("sha256").update(canonicalJson(normalizedState), "utf8").digest("hex"),
    normalizedState,
    stateVersion,
  };
}

function numberField(step: string, seed: number, body: unknown, field: string): number {
  if (typeof body === "object" && body !== null && field in body) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  throw new A1ScenarioError(step, seed, `response is missing the numeric '${field}' field`);
}

function firstColonyId(colonies: unknown): string | undefined {
  const list = (colonies as { colonies?: unknown }).colonies;
  if (Array.isArray(list) && list[0] && typeof list[0] === "object") {
    const id = (list[0] as { colonyId?: unknown }).colonyId;
    if (typeof id === "string") return id;
  }
  return undefined;
}

function firstColonyPlanetId(colonies: unknown): string | undefined {
  const list = (colonies as { colonies?: unknown }).colonies;
  if (Array.isArray(list) && list[0] && typeof list[0] === "object") {
    const id = (list[0] as { planetId?: unknown }).planetId;
    if (typeof id === "string") return id;
  }
  return undefined;
}

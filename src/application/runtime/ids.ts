// Feature: GAL-SIM-RUNTIME-001
// Fachliche Grundlage: docs/decisions/0003-mvp-simulations-und-schnittstellenmodell.md
// Architekturentscheidung: docs/decisions/0005-a0-server-technologiestack.md

export type ResourceId = string;
export type ResourceIdPrefix = string;

/** Creates opaque resource identifiers without exposing an entropy implementation. */
export interface IdGenerator {
  next(prefix: ResourceIdPrefix): ResourceId;
}

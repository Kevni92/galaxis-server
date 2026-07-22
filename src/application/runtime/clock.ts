// Feature: GAL-SIM-RUNTIME-001
// Fachliche Grundlage: docs/docs/01-gameplay/zeitmodell.md
// Architekturentscheidung: docs/decisions/0003-mvp-simulations-und-schnittstellenmodell.md

/** Milliseconds since an agreed epoch; ports do not expose Date or Node types. */
export type Milliseconds = number;

/** Reads the server's authoritative wall-clock time. */
export interface WallClock {
  now(): Milliseconds;
}

/** Reads campaign time independently of how the simulation is scheduled. */
export interface CampaignClock {
  now(): Milliseconds;
}

/** Campaign clocks that support the explicitly modelled pause state. */
export interface PausableCampaignClock extends CampaignClock {
  pause(): void;
  resume(): void;
  isPaused(): boolean;
}

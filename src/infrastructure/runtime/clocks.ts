// Feature: GAL-SIM-RUNTIME-001
// Fachliche Grundlage: docs/docs/01-gameplay/zeitmodell.md
// Ports: src/application/runtime/clock.ts

import type {
  CampaignClock,
  Milliseconds,
  PausableCampaignClock,
  WallClock,
} from "../../application/runtime/clock.js";

function assertFiniteMilliseconds(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`);
  }
}

/** Production wall clock. All direct system-time access stays in infrastructure. */
export class SystemWallClock implements WallClock {
  public now(): Milliseconds {
    return Date.now();
  }
}

/** Controllable wall clock for deterministic tests and headless simulation runs. */
export class FakeWallClock implements WallClock {
  private currentTime: Milliseconds;

  public constructor(initialTime: Milliseconds = 0) {
    assertFiniteMilliseconds(initialTime, "initialTime");
    this.currentTime = initialTime;
  }

  public now(): Milliseconds {
    return this.currentTime;
  }

  public set(time: Milliseconds): void {
    assertFiniteMilliseconds(time, "time");
    this.currentTime = time;
  }

  public advance(delta: Milliseconds): void {
    assertFiniteMilliseconds(delta, "delta");
    this.currentTime += delta;
  }
}

export interface ScaledCampaignClockOptions {
  readonly wallClock: WallClock;
  readonly speedFactor: number;
  readonly initialCampaignTime?: Milliseconds;
  readonly paused?: boolean;
}

/** Derives campaign time from one wall clock, a fixed profile factor and pause state. */
export class ScaledCampaignClock implements PausableCampaignClock {
  private readonly wallClock: WallClock;
  private readonly speedFactor: number;
  private anchorWallTime: Milliseconds;
  private anchorCampaignTime: Milliseconds;
  private paused: boolean;

  public constructor(options: ScaledCampaignClockOptions) {
    if (!Number.isFinite(options.speedFactor) || options.speedFactor <= 0) {
      throw new RangeError("speedFactor must be a finite positive number");
    }

    const initialCampaignTime = options.initialCampaignTime ?? 0;
    assertFiniteMilliseconds(initialCampaignTime, "initialCampaignTime");
    this.wallClock = options.wallClock;
    this.speedFactor = options.speedFactor;
    this.anchorWallTime = options.wallClock.now();
    this.anchorCampaignTime = initialCampaignTime;
    this.paused = options.paused ?? false;
  }

  public now(): Milliseconds {
    if (this.paused) return this.anchorCampaignTime;

    const elapsedWallTime = Math.max(0, this.wallClock.now() - this.anchorWallTime);
    return this.anchorCampaignTime + elapsedWallTime * this.speedFactor;
  }

  public pause(): void {
    if (this.paused) return;
    this.anchorCampaignTime = this.now();
    this.paused = true;
  }

  public resume(): void {
    if (!this.paused) return;
    this.anchorWallTime = this.wallClock.now();
    this.paused = false;
  }

  public isPaused(): boolean {
    return this.paused;
  }
}

/** Fully controllable campaign clock for tests that do not need wall-time conversion. */
export class FakeCampaignClock implements PausableCampaignClock, CampaignClock {
  private currentTime: Milliseconds;
  private paused: boolean;

  public constructor(initialTime: Milliseconds = 0, paused = false) {
    assertFiniteMilliseconds(initialTime, "initialTime");
    this.currentTime = initialTime;
    this.paused = paused;
  }

  public now(): Milliseconds {
    return this.currentTime;
  }

  public set(time: Milliseconds): void {
    assertFiniteMilliseconds(time, "time");
    this.currentTime = time;
  }

  public advance(delta: Milliseconds): void {
    if (this.paused) return;
    assertFiniteMilliseconds(delta, "delta");
    this.currentTime += delta;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  public isPaused(): boolean {
    return this.paused;
  }
}

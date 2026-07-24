import { describe, expect, it } from "vitest";

import {
  FakeCampaignClock,
  FakeWallClock,
  ScaledCampaignClock,
} from "../../src/infrastructure/runtime/clocks.js";
import { FakeIdGenerator, PrefixedIdGenerator } from "../../src/infrastructure/runtime/ids.js";
import {
  FakeCryptographicRandomSource,
  FakeRandomStream,
  SIMULATION_PRNG_ALGORITHM,
  XorShift32RandomStream,
} from "../../src/infrastructure/runtime/random.js";

describe("runtime providers", () => {
  it("advances wall and campaign time without sleeping", () => {
    const wallClock = new FakeWallClock(1_000);
    const campaignClock = new ScaledCampaignClock({
      wallClock,
      speedFactor: 2,
      initialCampaignTime: 500,
    });

    expect(campaignClock.now()).toBe(500);
    wallClock.advance(125);
    expect(campaignClock.now()).toBe(750);

    campaignClock.pause();
    wallClock.advance(500);
    expect(campaignClock.now()).toBe(750);
    campaignClock.resume();
    wallClock.advance(25);
    expect(campaignClock.now()).toBe(800);

    const fakeCampaignClock = new FakeCampaignClock();
    fakeCampaignClock.advance(42);
    expect(fakeCampaignClock.now()).toBe(42);
    fakeCampaignClock.pause();
    fakeCampaignClock.advance(10);
    expect(fakeCampaignClock.now()).toBe(42);
  });

  it("replays the documented PRNG golden sequence", () => {
    const stream = new XorShift32RandomStream(0x12345678, "combat-round");

    expect(stream.algorithm).toBe(SIMULATION_PRNG_ALGORITHM);
    expect([stream.nextUint32(), stream.nextUint32(), stream.nextUint32()]).toEqual([
      1_964_140_533, 74_955_619, 2_423_258_926,
    ]);
  });

  it("accepts contract-range seeds above 2^32 deterministically (regression for #57)", () => {
    const seed = 3_123_368_816_958_382; // exceeds 2^32, from a real client-reported failure
    const first = new XorShift32RandomStream(seed, "galaxy");
    const replay = new XorShift32RandomStream(seed, "galaxy");

    expect([first.nextUint32(), first.nextUint32()]).toEqual([
      replay.nextUint32(),
      replay.nextUint32(),
    ]);
  });

  it("distinguishes seeds that differ only above bit 32", () => {
    const UINT32_RANGE = 0x1_0000_0000;
    const low = new XorShift32RandomStream(42, "galaxy");
    const high = new XorShift32RandomStream(42 + UINT32_RANGE, "galaxy");

    expect(high.nextUint32()).not.toBe(low.nextUint32());
  });

  it("still rejects seeds outside the contract's safe-integer range", () => {
    expect(() => new XorShift32RandomStream(-1, "galaxy")).toThrow(RangeError);
    expect(() => new XorShift32RandomStream(1.5, "galaxy")).toThrow(RangeError);
    expect(() => new XorShift32RandomStream(Number.MAX_SAFE_INTEGER + 1, "galaxy")).toThrow(
      RangeError,
    );
  });

  it("separates streams while preserving seed and call-order determinism", () => {
    const first = new XorShift32RandomStream(42, "events");
    const replay = new XorShift32RandomStream(42, "events");
    const other = new XorShift32RandomStream(42, "combat");

    const firstValues = [first.nextInt(1000), first.nextInt(1000), first.nextInt(1000)];
    const replayValues = [replay.nextInt(1000), replay.nextInt(1000), replay.nextInt(1000)];

    expect(replayValues).toEqual(firstValues);
    expect([other.nextInt(1000), other.nextInt(1000), other.nextInt(1000)]).not.toEqual(
      firstValues,
    );
    expect(new FakeRandomStream([7, 8]).nextInt(10)).toBe(7);
  });

  it("keeps cryptographic bytes and resource IDs separate from simulation streams", () => {
    const bytes = Array.from({ length: 32 }, (_, index) => index + 1);
    const ids = new PrefixedIdGenerator(new FakeCryptographicRandomSource(bytes));
    const first = ids.next("planet");
    const second = ids.next("planet");

    expect(first).toMatch(/^planet_[0-9a-f]{32}$/u);
    expect(second).toMatch(/^planet_[0-9a-f]{32}$/u);
    expect(second).not.toBe(first);

    const fakeIds = new FakeIdGenerator();
    expect(fakeIds.next("fleet")).toBe("fleet_fake_0001");
    expect(fakeIds.next("fleet")).toBe("fleet_fake_0002");
    expect(fakeIds.next("planet")).toBe("planet_fake_0001");
  });
});

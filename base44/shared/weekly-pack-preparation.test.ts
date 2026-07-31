import { describe, expect, it } from "vitest";

import {
  WEEKLY_PACK_INITIALIZATION_LEASE_MS,
  weeklyPackInitializationState,
} from "./weekly-pack-preparation";

const NOW = Date.parse("2026-08-01T00:00:00.000Z");

describe("weekly pack initialization state", () => {
  it("advances only after both the design and research run ids are stored", () => {
    expect(
      weeklyPackInitializationState({
        design: { pack: {} },
        researchRuns: [{ runId: "run-1" }],
        attemptCount: 1,
        updatedAt: NOW,
        now: NOW,
      }),
    ).toBe("ready-to-advance");
  });

  it("keeps an incomplete preparation leased during an active invocation", () => {
    expect(
      weeklyPackInitializationState({
        attemptCount: 1,
        updatedAt: NOW - WEEKLY_PACK_INITIALIZATION_LEASE_MS + 1,
        now: NOW,
      }),
    ).toBe("initializing");
  });

  it("recovers an abandoned initialization after its lease expires", () => {
    expect(
      weeklyPackInitializationState({
        attemptCount: 1,
        updatedAt: NOW - WEEKLY_PACK_INITIALIZATION_LEASE_MS,
        now: NOW,
      }),
    ).toBe("recoverable");
  });

  it("stops spending after three abandoned initialization attempts", () => {
    expect(
      weeklyPackInitializationState({
        attemptCount: 3,
        updatedAt: 0,
        now: NOW,
      }),
    ).toBe("exhausted");
  });
});

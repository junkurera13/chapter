import { describe, expect, it } from "vitest";

import { extractionAttempts, extractionBudget } from "./memoryExtractor";

/** Must stay in step with `maxDuration` in app/api/memory/route.ts. */
const ROUTE_MAX_DURATION_MS = 120_000;

describe("extraction attempt ladder", () => {
  const attempts = extractionAttempts();

  it("retries the fast model before spending the budget on the fallback", () => {
    // Measured behaviour: the primary returns nothing about a third of the
    // time with several photos, and that failure is transient. One try meant
    // one bad roll cost the memory.
    const primary = attempts[0].modelId;
    expect(attempts.filter((a) => a.modelId === primary).length).toBeGreaterThanOrEqual(3);
  });

  it("still falls back to a second model if the primary is genuinely down", () => {
    const models = new Set(attempts.map((a) => a.modelId));
    expect(models.size).toBe(2);
    expect(attempts.at(-1)?.modelId).not.toBe(attempts[0].modelId);
  });

  it("gives the fallback at least as long as the primary", () => {
    // It runs on the same photos after the primary already failed, and it is
    // the slower model. Giving it less time is how a memory got lost.
    const primaryTimeout = attempts[0].timeoutMs;
    expect(attempts.at(-1)!.timeoutMs).toBeGreaterThanOrEqual(primaryTimeout);
  });

  it("cannot outlast the request waiting on it", () => {
    expect(extractionBudget.totalMs).toBeLessThan(ROUTE_MAX_DURATION_MS);
    // Room left over for the Base44 calls on either side of extraction.
    expect(ROUTE_MAX_DURATION_MS - extractionBudget.totalMs).toBeGreaterThanOrEqual(25_000);
  });

  it("leaves every attempt enough time to be worth making", () => {
    for (const attempt of attempts) {
      expect(attempt.timeoutMs).toBeGreaterThanOrEqual(extractionBudget.minAttemptMs);
    }
  });
});

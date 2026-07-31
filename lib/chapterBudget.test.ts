import { describe, expect, it } from "vitest";

import {
  auditChapterBudgetCost,
  CHAPTER_SPLURGE_COOLDOWN_MS,
  classifyChapterCost,
  compactChapterBudgetHistory,
  drawChapterBudgetTier,
} from "./chapterBudget";

describe("Chapter budget lanes", () => {
  it("keeps every small experience affordable", () => {
    expect(
      drawChapterBudgetTier({ scale: "small", random: () => 0.999 }),
    ).toBe("accessible");
  });

  it("allows planned mini experiences and rare splurges", () => {
    expect(
      drawChapterBudgetTier({ scale: "mini", random: () => 0.8 }),
    ).toBe("planned");
    expect(
      drawChapterBudgetTier({ scale: "mini", random: () => 0.98 }),
    ).toBe("splurge");
  });

  it("turns cost feedback into changed odds rather than a permanent ban", () => {
    expect(
      drawChapterBudgetTier({ scale: "mini", random: () => 0.8 }),
    ).toBe("planned");
    expect(
      drawChapterBudgetTier({
        scale: "mini",
        random: () => 0.8,
        preferAffordable: true,
      }),
    ).toBe("accessible");
    expect(
      drawChapterBudgetTier({
        scale: "mini",
        random: () => 0.999,
        preferAffordable: true,
        preserveAspirational: true,
      }),
    ).toBe("splurge");
  });

  it("blocks another splurge for four weeks", () => {
    const nowMs = 1_800_000_000_000;
    expect(
      drawChapterBudgetTier({
        scale: "proper",
        random: () => 0.999,
        nowMs,
        recentBudgets: [
          { tier: "splurge", createdAt: nowMs - CHAPTER_SPLURGE_COOLDOWN_MS + 1 },
        ],
      }),
    ).not.toBe("splurge");
    expect(
      drawChapterBudgetTier({
        scale: "proper",
        random: () => 0.999,
        nowMs,
        recentBudgets: [
          { tier: "splurge", createdAt: nowMs - CHAPTER_SPLURGE_COOLDOWN_MS },
        ],
      }),
    ).toBe("splurge");
  });

  it("does not let spam-clicking erase the latest splurge", () => {
    const history = compactChapterBudgetHistory([
      { tier: "splurge", createdAt: 100 },
      ...Array.from({ length: 100 }, (_, index) => ({
        tier: "accessible" as const,
        createdAt: 101 + index,
      })),
    ]);

    expect(history).toContainEqual({ tier: "splurge", createdAt: 100 });
    expect(history).toContainEqual({ tier: "accessible", createdAt: 200 });
    expect(history).toHaveLength(2);
  });

  it("classifies the researched cost and rejects a broken ceiling", () => {
    expect(classifyChapterCost(0)).toBe("accessible");
    expect(classifyChapterCost(30)).toBe("accessible");
    expect(classifyChapterCost(31)).toBe("planned");
    expect(classifyChapterCost(200)).toBe("splurge");
    expect(
      auditChapterBudgetCost({
        requestedTier: "accessible",
        estimatedTotalUsd: 75,
      }).valid,
    ).toBe(false);
    expect(
      auditChapterBudgetCost({
        requestedTier: "splurge",
        estimatedTotalUsd: 200,
      }).valid,
    ).toBe(true);
  });
});

/**
 * Cost is a commitment lane, not a fifth Chapter dimension. The equation
 * decides what becomes familiar or new; this module decides how much money a
 * person should plausibly need to say yes to that legal shape.
 */
export const CHAPTER_BUDGET_TIERS = [
  "accessible",
  "planned",
  "splurge",
] as const;

export type ChapterBudgetTier = (typeof CHAPTER_BUDGET_TIERS)[number];
export type ChapterBudgetHistoryEntry = {
  tier: ChapterBudgetTier;
  createdAt: number;
};

export const CHAPTER_BUDGET_CONTRACTS: Record<
  ChapterBudgetTier,
  {
    maxTotalUsd: number;
    label: string;
    designInstruction: string;
  }
> = {
  accessible: {
    maxTotalUsd: 30,
    label: "Affordable",
    designInstruction:
      "Keep the complete expected personal cost at or below USD 30 equivalent. Prefer free, public, subsidized, or genuinely low-cost formats.",
  },
  planned: {
    maxTotalUsd: 100,
    label: "Planned spend",
    designInstruction:
      "Keep the complete expected personal cost at or below USD 100 equivalent. The experience may require a considered purchase, but not saving up.",
  },
  splurge: {
    maxTotalUsd: 250,
    label: "Save for later",
    designInstruction:
      "This is a rare aspirational option. Keep the complete expected personal cost at or below USD 250 equivalent, and make the payoff strong enough to justify saving for it.",
  },
};

const BASE_WEIGHTS: Record<
  "small" | "mini" | "proper",
  Record<ChapterBudgetTier, number>
> = {
  // A small activity must remain easy to accept without deliberation.
  small: { accessible: 100, planned: 0, splurge: 0 },
  mini: { accessible: 70, planned: 25, splurge: 5 },
  proper: { accessible: 40, planned: 35, splurge: 25 },
};

/** A genuine splurge is unavailable for four weeks after the last one. */
export const CHAPTER_SPLURGE_COOLDOWN_MS = 28 * 24 * 60 * 60 * 1_000;

/**
 * The lab may be clicked hundreds of times in a month. Retain the newest
 * occurrence of each lane instead of a tail of clicks, so cheap generations
 * cannot push the last splurge out of cooldown memory.
 */
export function compactChapterBudgetHistory(
  history: readonly ChapterBudgetHistoryEntry[],
) {
  const latest = new Map<ChapterBudgetTier, ChapterBudgetHistoryEntry>();
  for (const entry of history) {
    const current = latest.get(entry.tier);
    if (!current || entry.createdAt > current.createdAt) {
      latest.set(entry.tier, entry);
    }
  }
  return CHAPTER_BUDGET_TIERS.flatMap((tier) => {
    const entry = latest.get(tier);
    return entry ? [entry] : [];
  });
}

function boundedRandom(random: () => number) {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1 - Number.EPSILON);
}

export function drawChapterBudgetTier(args: {
  scale: "small" | "mini" | "proper";
  random: () => number;
  recentBudgets?: readonly ChapterBudgetHistoryEntry[];
  nowMs?: number;
  preferAffordable?: boolean;
  preserveAspirational?: boolean;
}): ChapterBudgetTier {
  const nowMs = args.nowMs ?? Date.now();
  const recentSplurge = (args.recentBudgets ?? []).some(
    (entry) =>
      entry.tier === "splurge" &&
      entry.createdAt <= nowMs &&
      nowMs - entry.createdAt < CHAPTER_SPLURGE_COOLDOWN_MS,
  );
  const weights = { ...BASE_WEIGHTS[args.scale] };

  if (recentSplurge) weights.splurge = 0;
  if (args.preferAffordable) {
    weights.accessible *= 1.75;
    weights.planned *= 0.7;
    weights.splurge *= args.preserveAspirational ? 0.65 : 0.2;
  }

  const total = CHAPTER_BUDGET_TIERS.reduce(
    (sum, tier) => sum + weights[tier],
    0,
  );
  let cursor = boundedRandom(args.random) * total;
  for (const tier of CHAPTER_BUDGET_TIERS) {
    cursor -= weights[tier];
    if (cursor < 0) return tier;
  }
  return "accessible";
}

export function classifyChapterCost(totalUsd: number): ChapterBudgetTier {
  if (totalUsd <= CHAPTER_BUDGET_CONTRACTS.accessible.maxTotalUsd) {
    return "accessible";
  }
  if (totalUsd <= CHAPTER_BUDGET_CONTRACTS.planned.maxTotalUsd) {
    return "planned";
  }
  return "splurge";
}

export function auditChapterBudgetCost(args: {
  requestedTier: ChapterBudgetTier;
  estimatedTotalUsd: number;
}) {
  const maximum = CHAPTER_BUDGET_CONTRACTS[args.requestedTier].maxTotalUsd;
  if (
    !Number.isFinite(args.estimatedTotalUsd) ||
    args.estimatedTotalUsd < 0 ||
    args.estimatedTotalUsd > maximum
  ) {
    return {
      valid: false,
      message: `The verified total of USD ${args.estimatedTotalUsd} exceeds the ${args.requestedTier} ceiling of USD ${maximum}.`,
    };
  }
  return { valid: true, message: "" };
}

/**
 * In the Lab, an affordable draw is a preference for mini and proper
 * experiences rather than a reason to discard a fully proved moderate-cost
 * result. Small experiences stay strictly affordable, and a real splurge
 * still requires the rare splurge draw with its four-week cooldown.
 */
export function auditAdventureLabBudgetCost(args: {
  scale: "small" | "mini" | "proper";
  requestedTier: ChapterBudgetTier;
  estimatedTotalUsd: number;
}) {
  const actualTier = classifyChapterCost(args.estimatedTotalUsd);
  const maximum =
    args.scale === "small"
      ? CHAPTER_BUDGET_CONTRACTS.accessible.maxTotalUsd
      : args.requestedTier === "splurge"
        ? CHAPTER_BUDGET_CONTRACTS.splurge.maxTotalUsd
        : CHAPTER_BUDGET_CONTRACTS.planned.maxTotalUsd;

  if (
    !Number.isFinite(args.estimatedTotalUsd) ||
    args.estimatedTotalUsd < 0 ||
    args.estimatedTotalUsd > maximum
  ) {
    return {
      valid: false,
      actualTier,
      message: `The verified total of USD ${args.estimatedTotalUsd} exceeds this ${args.scale} experience's current ceiling of USD ${maximum}.`,
    };
  }

  return { valid: true, actualTier, message: "" };
}

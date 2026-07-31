export const WEEKLY_PACK_INITIALIZATION_LEASE_MS = 6 * 60 * 1_000;
export const WEEKLY_PACK_MAX_INITIALIZATION_ATTEMPTS = 3;

export type WeeklyPackInitializationState =
  | "ready-to-advance"
  | "initializing"
  | "recoverable"
  | "exhausted";

export function weeklyPackInitializationState(args: {
  design?: unknown;
  researchRuns?: unknown;
  attemptCount: number;
  updatedAt: number;
  now?: number;
}): WeeklyPackInitializationState {
  if (args.design && args.researchRuns) return "ready-to-advance";
  if (args.attemptCount >= WEEKLY_PACK_MAX_INITIALIZATION_ATTEMPTS) {
    return "exhausted";
  }

  const now = args.now ?? Date.now();
  return now - args.updatedAt >= WEEKLY_PACK_INITIALIZATION_LEASE_MS
    ? "recoverable"
    : "initializing";
}

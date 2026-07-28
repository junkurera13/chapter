import type {
  WeeklyExperiencePack,
  WeeklyPackPublicStatus,
} from "./weeklyPackSchema";

export type StoredWeeklyPackStatus =
  | "preparing"
  | "ready"
  | "chosen"
  | "lived"
  | "dismissed"
  | "failed";

export function publicWeeklyPackStatus(args: {
  storedStatus: StoredWeeklyPackStatus;
  releaseAt: number;
  expiresAt: number;
  now?: number;
}): WeeklyPackPublicStatus {
  const now = args.now ?? Date.now();
  if (args.storedStatus === "failed") return "failed";
  if (args.storedStatus === "lived") return "lived";
  if (args.storedStatus === "dismissed") return "dismissed";
  if (args.storedStatus === "chosen") {
    return now >= args.expiresAt ? "expired" : "chosen";
  }
  if (now >= args.expiresAt) return "expired";
  if (args.storedStatus === "preparing" || now < args.releaseAt) {
    return "locked";
  }
  return "available";
}

/**
 * Contents do not cross the server boundary before release. This is product
 * truth, not a CSS cover over cards already delivered to the browser.
 */
export function redactLockedWeeklyPack(
  pack: WeeklyExperiencePack,
): WeeklyExperiencePack {
  return pack.status === "locked"
    ? {
        ...pack,
        cards: undefined,
        revealedCardIds: [],
        chosenCardId: undefined,
        scheduledFor: undefined,
      }
    : pack;
}

export function canChooseWeeklyCard(pack: WeeklyExperiencePack) {
  return pack.status === "available" && Boolean(pack.cards?.length);
}

export function canScheduleWeeklyCard(pack: WeeklyExperiencePack) {
  return pack.status === "chosen" && Boolean(pack.chosenCardId);
}


import type { WeeklyPackScale } from "./weeklyPackDesign";
import type { WeeklyExperiencePack } from "./weeklyPackSchema";

export type WeeklyPackPhase =
  | "loading"
  | "opener"
  | "locked"
  | "sealed"
  | "one-revealed"
  | "all-revealed"
  | "confirming"
  | "chosen"
  | "date-picker"
  | "scheduled"
  | "lived"
  | "dismissed"
  | "expired"
  | "failed"
  | "error";

type WeeklyPackSurfaceState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; pack: WeeklyExperiencePack | null };

export function weeklyPackPhase({
  state,
  openedPackId,
  pendingChoice,
  showDatePicker,
}: {
  state: WeeklyPackSurfaceState;
  openedPackId: string | null;
  pendingChoice: WeeklyPackScale | null;
  showDatePicker: boolean;
}): WeeklyPackPhase {
  if (state.status === "loading" || state.status === "error") {
    return state.status;
  }

  const { pack } = state;
  if (!pack || pack.status === "locked") return "locked";
  if (
    pack.status === "dismissed" ||
    pack.status === "expired" ||
    pack.status === "failed"
  ) {
    return pack.status;
  }

  const cards = pack.cards;
  if (!cards || cards.length !== 3) return "error";

  if (pack.status === "lived") {
    return cards.some((card) => card.id === pack.chosenCardId)
      ? "lived"
      : "error";
  }

  if (pack.status === "chosen") {
    if (!cards.some((card) => card.id === pack.chosenCardId)) return "error";
    if (showDatePicker) return "date-picker";
    return pack.scheduledFor ? "scheduled" : "chosen";
  }

  const cardIds = new Set(cards.map((card) => card.id));
  const revealedCount = new Set(
    pack.revealedCardIds.filter((cardId) => cardIds.has(cardId)),
  ).size;
  const hasPendingChoice =
    pendingChoice !== null &&
    cardIds.has(pendingChoice) &&
    pack.revealedCardIds.includes(pendingChoice);

  if (hasPendingChoice) return "confirming";
  if (revealedCount === 0) {
    return openedPackId === pack.id ? "sealed" : "opener";
  }
  return revealedCount === cards.length ? "all-revealed" : "one-revealed";
}

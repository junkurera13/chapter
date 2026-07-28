import type {
  WeeklyExperienceCard,
  WeeklyExperiencePack,
} from "./weeklyPackSchema";
import type { WeeklyPackScale } from "./weeklyPackDesign";

export const WEEKLY_PACK_REVIEW_STATES = [
  { id: "loading", label: "Loading" },
  { id: "opener", label: "Ready to open" },
  { id: "locked", label: "Locked until Saturday" },
  { id: "sealed", label: "Three sealed cards" },
  { id: "one-revealed", label: "One card revealed" },
  { id: "all-revealed", label: "All cards revealed" },
  { id: "confirming", label: "Confirming a choice" },
  { id: "chosen", label: "Chosen experience" },
  { id: "date-picker", label: "Choosing a day" },
  { id: "scheduled", label: "Day scheduled" },
  { id: "lived", label: "Experience completed" },
  { id: "dismissed", label: "Pack dismissed" },
  { id: "expired", label: "Pack expired" },
  { id: "failed", label: "Pack generation failed" },
  { id: "error", label: "Pack could not load" },
] as const;

export type WeeklyPackReviewState =
  (typeof WEEKLY_PACK_REVIEW_STATES)[number]["id"];

export type WeeklyPackReviewFixture = {
  state:
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; pack: WeeklyExperiencePack | null };
  pendingChoice?: WeeklyPackScale;
  showDatePicker?: boolean;
  scheduledFor?: string;
};

export function weeklyPackReviewStateFrom(
  value: string | undefined,
): WeeklyPackReviewState | undefined {
  return WEEKLY_PACK_REVIEW_STATES.some((state) => state.id === value)
    ? (value as WeeklyPackReviewState)
    : undefined;
}

const previewCards: WeeklyExperienceCard[] = [
  {
    id: "small",
    scale: "small",
    company: "self",
    title: "Map a street by sound",
    promise:
      "Walk one familiar street without headphones and leave with a tiny field recording made from five sounds you normally pass through.",
    opening:
      "The street is already part of your life. This time, move through it as if you were responsible for its soundtrack.",
    durationMinutes: { min: 45, max: 60 },
    place: {
      name: "Your usual neighbourhood",
      area: "Within walking distance",
      address: "Begin at a corner you already know",
    },
    steps: [
      "Start at a familiar corner and put your phone on airplane mode.",
      "Walk until five distinct sounds make you stop. Record ten seconds of each.",
      "Sit somewhere ordinary, put the clips in order, and give the minute a title.",
    ],
    practical: [
      { label: "When", value: "The hour before sunset" },
      { label: "Bring", value: "Your phone and nothing else" },
      { label: "Cost", value: "Free" },
      { label: "Weather", value: "Save it for a dry evening" },
    ],
    sourceUrls: [],
    image: null,
  },
  {
    id: "mini",
    scale: "mini",
    company: "new-person",
    title: "Make one bowl beside someone new",
    promise:
      "Join a bounded beginner pottery table where conversation has something to orbit, then leave with one imperfect object of your own.",
    opening:
      "Nobody has to be interesting on command when both hands are busy. The clay carries the first hour; whatever follows is allowed to be ordinary.",
    durationMinutes: { min: 150, max: 180 },
    place: {
      name: "A researched beginner open studio",
      area: "Within the city",
      address: "The final pack supplies the verified studio and arrival point",
    },
    steps: [
      "Arrive ten minutes early and take any open place at the shared table.",
      "Make one useful bowl rather than trying to make something impressive.",
      "Ask the person beside you what they want theirs to become, if a natural moment appears.",
    ],
    practical: [
      { label: "When", value: "A weekend afternoon session" },
      { label: "Booking", value: "One reserved beginner seat" },
      { label: "Cost", value: "Materials and firing included" },
      { label: "Exit", value: "The session ends after one piece" },
    ],
    sourceUrls: [],
    image: null,
  },
  {
    id: "proper",
    scale: "proper",
    company: "known-person",
    title: "Follow the water out of the city",
    promise:
      "Take someone you already know from the last dense stretch of river to its quieter edge, collecting one small proof of each change along the way.",
    opening:
      "Begin where the water still feels like part of the city. End where the city has stopped explaining itself. The journey between them is the day.",
    durationMinutes: { min: 360, max: 480 },
    place: {
      name: "A verified river-to-edge route",
      area: "City to beyond-city",
      address: "The final pack supplies both stations and the return route",
    },
    steps: [
      "Meet beside the busiest section of water and choose one thing to collect: colours, overheard phrases, or small drawings.",
      "Travel outward in three legs, stopping once when the river changes character.",
      "Eat somewhere simple near the final waterline and each choose the one collected thing worth keeping.",
      "Return before the final comfortable connection home.",
    ],
    practical: [
      { label: "When", value: "A clear Saturday, starting before 10" },
      { label: "Travel", value: "Rail outward, with a verified return" },
      { label: "Bring", value: "Water, a small notebook, and good shoes" },
      { label: "Cost", value: "Transport and one simple meal" },
    ],
    sourceUrls: [],
    image: null,
  },
];

function previewPack(args?: {
  status?: WeeklyExperiencePack["status"];
  revealedCardIds?: WeeklyPackScale[];
  chosenCardId?: WeeklyPackScale;
  scheduledFor?: string;
  livedAt?: number;
}): WeeklyExperiencePack {
  const releaseAt = Date.UTC(2026, 7, 1, 0);
  const expiresAt = Date.UTC(2026, 7, 22, 0);
  if (args?.status === "locked") {
    return {
      id: "preview-weekly-pack",
      weekKey: "2026-08-01",
      status: "locked",
      releaseAt,
      expiresAt,
      revealedCardIds: [],
    };
  }
  return {
    id: "preview-weekly-pack",
    weekKey: "2026-08-01",
    status: args?.status ?? "available",
    releaseAt,
    expiresAt,
    cards: previewCards,
    revealedCardIds: args?.revealedCardIds ?? [],
    chosenCardId: args?.chosenCardId,
    scheduledFor: args?.scheduledFor,
    livedAt: args?.livedAt,
  };
}

export function weeklyPackReviewFixture(
  reviewState: WeeklyPackReviewState,
): WeeklyPackReviewFixture {
  switch (reviewState) {
    case "loading":
      return { state: { status: "loading" } };
    case "error":
      return {
        state: {
          status: "error",
          message: "Chapter couldn’t open this week’s pack.",
        },
      };
    case "opener":
      return {
        state: { status: "ready", pack: previewPack() },
      };
    case "locked":
      return {
        state: { status: "ready", pack: previewPack({ status: "locked" }) },
      };
    case "sealed":
      return {
        state: { status: "ready", pack: previewPack() },
      };
    case "one-revealed":
      return {
        state: {
          status: "ready",
          pack: previewPack({ revealedCardIds: ["small"] }),
        },
      };
    case "all-revealed":
      return {
        state: {
          status: "ready",
          pack: previewPack({
            revealedCardIds: ["small", "mini", "proper"],
          }),
        },
      };
    case "confirming":
      return {
        state: {
          status: "ready",
          pack: previewPack({
            revealedCardIds: ["small", "mini", "proper"],
          }),
        },
        pendingChoice: "mini",
      };
    case "chosen":
      return {
        state: {
          status: "ready",
          pack: previewPack({
            status: "chosen",
            revealedCardIds: ["mini"],
            chosenCardId: "mini",
          }),
        },
      };
    case "date-picker":
      return {
        state: {
          status: "ready",
          pack: previewPack({
            status: "chosen",
            revealedCardIds: ["mini"],
            chosenCardId: "mini",
          }),
        },
        showDatePicker: true,
        scheduledFor: "2026-08-08",
      };
    case "scheduled":
      return {
        state: {
          status: "ready",
          pack: previewPack({
            status: "chosen",
            revealedCardIds: ["mini"],
            chosenCardId: "mini",
            scheduledFor: "2026-08-08",
          }),
        },
      };
    case "lived":
      return {
        state: {
          status: "ready",
          pack: previewPack({
            status: "lived",
            revealedCardIds: ["mini"],
            chosenCardId: "mini",
            scheduledFor: "2026-08-08",
            livedAt: Date.UTC(2026, 7, 8, 12),
          }),
        },
      };
    case "dismissed":
    case "expired":
    case "failed":
      return {
        state: {
          status: "ready",
          pack: previewPack({ status: reviewState }),
        },
      };
  }
}

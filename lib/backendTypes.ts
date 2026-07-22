import type { QuestPayload } from "./quest";

export type QuestOutcome = "won" | "lost" | "skipped";
export type QuestSource = "admin" | "imessage" | "terminal";

export type QuestRecord = QuestPayload & {
  shortId: string;
  request: string;
  phone?: string;
  initialRequest?: string;
  followupAnswer?: string;
  source?: QuestSource;
  createdAt: number;
  outcome?: QuestOutcome;
  outcomeAt?: number;
};

export type OnboardingStep =
  | "needs_memory_invite"
  | "awaiting_memory"
  | "awaiting_first_window"
  | "first_quest_ready"
  | "needs_cold_quest"
  | "awaiting_cold_response"
  | "awaiting_name"
  | "awaiting_mirror"
  | "awaiting_location"
  | "complete";

export type ConversationState = "idle" | "awaiting_followup";

export type MirrorAnswer = {
  question: string;
  answer: string;
  askedAt: number;
};

export type UserProfile = {
  phone: string;
  firstSeenAt: number;
  state?: ConversationState;
  pendingRequest?: string;
  country?: string;
  name?: string;
  homeCity?: string;
  currentCity?: string;
  onVacation?: boolean;
  notes?: string;
  memoryUpdatedAt?: number;
  signedUpAt?: number;
  assignedPhone?: string;
  firstSidequestWindowText?: string;
  latitude?: number;
  longitude?: number;
  onboardingStep?: OnboardingStep;
  mirrorAnswers?: MirrorAnswer[];
};

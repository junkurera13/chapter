export const EXPERIENCE_NODE_CATEGORIES = [
  "experience",
  "people",
  "place",
  "activity",
  "interest",
  "feeling",
  "condition",
  "pattern",
] as const;

export type ExperienceNodeCategory =
  (typeof EXPERIENCE_NODE_CATEGORIES)[number];

export const EXPERIENCE_RELATIONS = [
  "lived",
  "cares_about",
  "shared_with",
  "happened_at",
  "involved",
  "evoked",
  "shaped_by",
  "supported",
  "reflects",
  "part_of",
  "drawn_to",
  "familiar_with",
  "curious_about",
  "avoids",
  "requires",
  "reinforces",
  "contrasts_with",
  "discovered_through",
] as const;

export type ExperienceRelation = (typeof EXPERIENCE_RELATIONS)[number];

export const EXPERIENCE_POLARITIES = [
  "positive",
  "negative",
  "mixed",
  "neutral",
] as const;

export type ExperiencePolarity = (typeof EXPERIENCE_POLARITIES)[number];

export const EXPERIENCE_FAMILIARITIES = [
  "familiar",
  "new",
  "mixed",
  "not_applicable",
] as const;

export type ExperienceFamiliarity =
  (typeof EXPERIENCE_FAMILIARITIES)[number];

export const EXPERIENCE_CATEGORY_META: Record<
  ExperienceNodeCategory,
  {
    label: string;
    purpose: string;
    subtypeExamples: readonly string[];
  }
> = {
  experience: {
    label: "Moment",
    purpose: "A real episode, memory, trip, ritual, or Sidequest someone lived.",
    subtypeExamples: ["meaningful_memory", "trip", "ritual", "sidequest"],
  },
  people: {
    label: "People",
    purpose: "A person, group, or relationship present in someone's life.",
    subtypeExamples: ["person", "close_group", "family", "stranger"],
  },
  place: {
    label: "Place",
    purpose: "A specific location or a useful archetype of location.",
    subtypeExamples: ["cafe", "trail", "neighbourhood", "coastal_island"],
  },
  activity: {
    label: "Activity",
    purpose: "Something a person can actively do or participate in.",
    subtypeExamples: ["movement", "food", "culture", "craft"],
  },
  interest: {
    label: "Interest",
    purpose: "A subject, taste, cuisine, medium, or domain that draws attention.",
    subtypeExamples: ["cuisine", "music", "film", "architecture"],
  },
  feeling: {
    label: "Feeling",
    purpose: "An emotional or embodied state that arose or is desired.",
    subtypeExamples: ["nostalgia", "connection", "freedom", "calm"],
  },
  condition: {
    label: "Condition",
    purpose: "A circumstance, preference, or hard boundary that shapes fit.",
    subtypeExamples: ["planning_style", "crowd_level", "time", "hard_boundary"],
  },
  pattern: {
    label: "Pattern",
    purpose: "A transferable value or relationship Sidequest notices across evidence.",
    subtypeExamples: ["value", "recurring_preference", "tension", "emerging_curiosity"],
  },
};

export const EXPERIENCE_RELATION_META: Record<
  ExperienceRelation,
  { forward: string; reverse: string }
> = {
  lived: { forward: "lived", reverse: "lived by" },
  cares_about: { forward: "cares about", reverse: "important to" },
  shared_with: { forward: "shared with", reverse: "shared with" },
  happened_at: { forward: "happened at", reverse: "held this moment" },
  involved: { forward: "involved", reverse: "part of" },
  evoked: { forward: "evoked", reverse: "felt through" },
  shaped_by: { forward: "shaped by", reverse: "shaped" },
  supported: { forward: "supported", reverse: "supported by" },
  reflects: { forward: "reflects", reverse: "revealed through" },
  part_of: { forward: "part of", reverse: "contains" },
  drawn_to: { forward: "drawn to", reverse: "draws" },
  familiar_with: { forward: "familiar with", reverse: "familiar to" },
  curious_about: { forward: "curious about", reverse: "sparks curiosity in" },
  avoids: { forward: "avoids", reverse: "avoided by" },
  requires: { forward: "requires", reverse: "required by" },
  reinforces: { forward: "reinforces", reverse: "reinforced by" },
  contrasts_with: { forward: "contrasts with", reverse: "contrasts with" },
  discovered_through: { forward: "discovered through", reverse: "revealed" },
};

export function humanizeExperienceSubtype(subtype: string) {
  return subtype.replaceAll("_", " ");
}

export function getExperienceRelationLabel(
  relation: ExperienceRelation,
  direction: "forward" | "reverse",
) {
  return EXPERIENCE_RELATION_META[relation][direction];
}

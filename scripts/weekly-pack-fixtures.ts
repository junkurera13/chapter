import type {
  ExperienceGraphEdgeRecord,
  ExperienceGraphNodeRecord,
  ExperienceGraphRecord,
} from "../lib/backendTypes";
import type {
  WeeklyPackCompany,
  WeeklyPackContext,
} from "../lib/weeklyPackDesign";

export type WeeklyPackFixture = {
  id: string;
  description: string;
  graph: ExperienceGraphRecord;
  context: WeeklyPackContext;
};

type NodeInput = Pick<
  ExperienceGraphNodeRecord,
  "id" | "category" | "label"
> &
  Partial<
    Omit<ExperienceGraphNodeRecord, "id" | "category" | "label">
  >;

type EdgeInput = Pick<
  ExperienceGraphEdgeRecord,
  "fromNodeId" | "toNodeId" | "relation"
> &
  Partial<
    Omit<
      ExperienceGraphEdgeRecord,
      "id" | "memoryId" | "fromNodeId" | "toNodeId" | "relation"
    >
  >;

function node(input: NodeInput): ExperienceGraphNodeRecord {
  return {
    sourceType: "memory",
    subtype: input.category,
    kind: input.category,
    description: input.label,
    certainty: "fact",
    confidence: 0.9,
    salience: 0.8,
    evidence: "Synthetic fixture evidence",
    createdAt: 1,
    ...input,
  };
}

function edge(
  input: EdgeInput,
  index: number,
): ExperienceGraphEdgeRecord {
  return {
    id: `edge-${index}`,
    memoryId: "synthetic-memory",
    polarity: "positive",
    familiarity: "familiar",
    strength: 0.85,
    certainty: "fact",
    createdAt: 1,
    ...input,
  };
}

function graph(
  nodes: NodeInput[],
  edges: EdgeInput[],
): ExperienceGraphRecord {
  return {
    memoryCount: 1,
    onboardingStep: "memory_ready",
    nodes: nodes.map(node),
    edges: edges.map(edge),
  };
}

function context(args: {
  homeCity?: string;
  privacyMode?: WeeklyPackContext["privacyMode"];
  availableCompanies?: readonly WeeklyPackCompany[];
  maxMechanismOccurrences?: WeeklyPackContext["maxMechanismOccurrences"];
  generationNotes?: readonly string[];
}): WeeklyPackContext {
  return {
    homeCity: args.homeCity ?? "Seoul",
    privacyMode: args.privacyMode ?? "personal",
    availableCompanies: args.availableCompanies ?? ["self"],
    maxMechanismOccurrences: args.maxMechanismOccurrences,
    generationNotes: args.generationNotes,
  };
}

export const WEEKLY_PACK_FIXTURES: readonly WeeklyPackFixture[] = [
  {
    id: "sparse",
    description:
      "One meaningful memory with a person, activity, place, and feeling.",
    graph: graph(
      [
        {
          id: "sparse-moment",
          category: "experience",
          label: "A quiet dawn walk before the city woke",
          subtype: "meaningful_memory",
          description:
            "A single recalled morning whose factual elements are walking, dawn, a riverside, and a sibling.",
          salience: 0.98,
        },
        {
          id: "sparse-walk",
          category: "activity",
          label: "walking",
          subtype: "movement",
          description: "Walking was part of the recalled experience.",
          salience: 0.9,
        },
        {
          id: "sparse-river",
          category: "place",
          label: "riverside",
          subtype: "waterside",
          description: "The memory happened beside a river.",
          salience: 0.78,
        },
        {
          id: "sparse-sibling",
          category: "people",
          label: "older sibling",
          subtype: "family",
          description: "An older sibling was present.",
          salience: 0.82,
        },
        {
          id: "sparse-calm",
          category: "feeling",
          label: "unhurried calm",
          subtype: "calm",
          description: "The moment was remembered as unhurried.",
          salience: 0.74,
        },
      ],
      [
        {
          fromNodeId: "sparse-moment",
          toNodeId: "sparse-walk",
          relation: "involved",
        },
        {
          fromNodeId: "sparse-moment",
          toNodeId: "sparse-river",
          relation: "happened_at",
        },
        {
          fromNodeId: "sparse-moment",
          toNodeId: "sparse-sibling",
          relation: "shared_with",
        },
        {
          fromNodeId: "sparse-moment",
          toNodeId: "sparse-calm",
          relation: "evoked",
        },
      ],
    ),
    context: context({
      generationNotes: [
        "Produce three distinct scales without inventing additional preferences.",
        "Do not create three literal variations of walking by a river.",
      ],
    }),
  },
  {
    id: "food-heavy",
    description:
      "Several restaurant, cooking, market, and family-meal memories.",
    graph: graph(
      [
        {
          id: "food-cooking",
          category: "activity",
          label: "cooking dumplings by hand",
          subtype: "food",
          description: "Making dumplings was repeated across two memories.",
          salience: 0.96,
        },
        {
          id: "food-market",
          category: "place",
          label: "traditional produce market",
          subtype: "market",
          description: "A traditional market was a familiar setting.",
          salience: 0.82,
        },
        {
          id: "food-fermentation",
          category: "interest",
          label: "fermentation",
          subtype: "food_craft",
          description: "Fermentation appeared as a factual area of curiosity.",
          salience: 0.78,
        },
        {
          id: "food-family-table",
          category: "pattern",
          label: "preparing a table together",
          subtype: "recurring_preference",
          description:
            "The graph supports a repeated pattern of shared preparation before eating.",
          salience: 0.9,
        },
        {
          id: "food-morning",
          category: "condition",
          label: "slow weekend mornings",
          subtype: "time",
          description: "Weekend mornings recur as a familiar condition.",
          salience: 0.7,
        },
        {
          id: "food-ceramics",
          category: "interest",
          label: "handmade serving ware",
          subtype: "craft",
          description: "Serving ware appears as an adjacent factual interest.",
          salience: 0.72,
        },
      ],
      [
        {
          fromNodeId: "food-cooking",
          toNodeId: "food-family-table",
          relation: "reinforces",
        },
        {
          fromNodeId: "food-market",
          toNodeId: "food-cooking",
          relation: "supported",
        },
        {
          fromNodeId: "food-fermentation",
          toNodeId: "food-cooking",
          relation: "part_of",
          strength: 0.66,
        },
        {
          fromNodeId: "food-ceramics",
          toNodeId: "food-family-table",
          relation: "supported",
          strength: 0.62,
        },
      ],
    ),
    context: context({
      maxMechanismOccurrences: { taste: 1 },
      generationNotes: [
        "Keep at most one meal-led or tasting-led experience.",
        "Transform the other food threads through making, sourcing, ritual, time, movement, or material culture.",
      ],
    }),
  },
  {
    id: "many-interests",
    description:
      "Many interest nodes with low salience and weak relationship structure.",
    graph: graph(
      [
        {
          id: "many-film",
          category: "interest",
          label: "independent film",
          confidence: 0.74,
          salience: 0.62,
        },
        {
          id: "many-type",
          category: "interest",
          label: "typography",
          confidence: 0.7,
          salience: 0.58,
        },
        {
          id: "many-birds",
          category: "interest",
          label: "urban birds",
          confidence: 0.66,
          salience: 0.56,
        },
        {
          id: "many-running",
          category: "activity",
          label: "running",
          confidence: 0.78,
          salience: 0.65,
        },
        {
          id: "many-jazz",
          category: "interest",
          label: "jazz",
          confidence: 0.64,
          salience: 0.54,
        },
        {
          id: "many-books",
          category: "activity",
          label: "browsing second-hand books",
          description:
            "The only activity repeated across more than one synthetic memory.",
          occurrenceCount: 3,
          confidence: 0.94,
          salience: 0.91,
        },
        {
          id: "many-old-streets",
          category: "place",
          label: "older commercial streets",
          confidence: 0.9,
          salience: 0.84,
        },
      ],
      [
        {
          fromNodeId: "many-books",
          toNodeId: "many-old-streets",
          relation: "happened_at",
          strength: 0.92,
        },
        {
          fromNodeId: "many-type",
          toNodeId: "many-books",
          relation: "discovered_through",
          strength: 0.38,
          certainty: "hypothesis",
        },
      ],
    ),
    context: context({
      generationNotes: [
        "Prefer evidence strength over topical abundance.",
        "Keep personalization modest; weakly related interests do not prove emotional significance.",
      ],
    }),
  },
  {
    id: "existing-friend",
    description:
      "A privacy-safe intersection for two accepted connections.",
    graph: graph(
      [
        {
          id: "friend-printing",
          category: "activity",
          label: "making small printed objects",
          description:
            "Both shareable worlds contain this activity at fact certainty.",
          sourceType: "connection",
          salience: 0.91,
        },
        {
          id: "friend-architecture",
          category: "interest",
          label: "adaptive reuse architecture",
          description:
            "Both shareable worlds contain this interest at fact certainty.",
          sourceType: "connection",
          salience: 0.84,
        },
        {
          id: "friend-alley",
          category: "place",
          label: "older workshop alleys",
          description:
            "Both shareable worlds contain this place archetype.",
          sourceType: "connection",
          salience: 0.78,
        },
        {
          id: "friend-walking",
          category: "activity",
          label: "unhurried city walking",
          description:
            "Both shareable worlds contain this activity.",
          sourceType: "connection",
          salience: 0.72,
        },
      ],
      [
        {
          fromNodeId: "friend-printing",
          toNodeId: "friend-alley",
          relation: "familiar_with",
        },
        {
          fromNodeId: "friend-architecture",
          toNodeId: "friend-walking",
          relation: "discovered_through",
        },
      ],
    ),
    context: context({
      privacyMode: "intersection",
      availableCompanies: ["self", "known-person"],
      generationNotes: [
        "At least one card should gain real value from two people doing something together.",
        "Every sentence must be true in both shareable worlds; use no one-sided memory.",
      ],
    }),
  },
  {
    id: "eligible-stranger",
    description:
      "A same-city strict intersection with enough familiar ground for one safe introduction.",
    graph: graph(
      [
        {
          id: "stranger-sketch",
          category: "activity",
          label: "observational sketching",
          description:
            "Both privacy-safe worlds contain observational sketching.",
          sourceType: "connection",
          salience: 0.94,
        },
        {
          id: "stranger-gardens",
          category: "place",
          label: "public gardens",
          description: "Both privacy-safe worlds contain public gardens.",
          sourceType: "connection",
          salience: 0.88,
        },
        {
          id: "stranger-plants",
          category: "interest",
          label: "seasonal plants",
          description: "Both privacy-safe worlds contain seasonal plants.",
          sourceType: "connection",
          salience: 0.82,
        },
        {
          id: "stranger-tea",
          category: "interest",
          label: "tea",
          description: "Both privacy-safe worlds contain tea.",
          sourceType: "connection",
          salience: 0.68,
        },
      ],
      [
        {
          fromNodeId: "stranger-sketch",
          toNodeId: "stranger-gardens",
          relation: "happened_at",
        },
        {
          fromNodeId: "stranger-plants",
          toNodeId: "stranger-gardens",
          relation: "part_of",
        },
      ],
    ),
    context: context({
      privacyMode: "intersection",
      availableCompanies: ["self", "new-person"],
      generationNotes: [
        "Include at most one new-person card and spend its only stretch on the person.",
        "Keep its place, activity, and time familiar, public, bounded, activity-centred, and easy to leave.",
      ],
    }),
  },
  {
    id: "no-social",
    description:
      "A personal graph with no eligible connection, introduction, or group.",
    graph: graph(
      [
        {
          id: "solo-cycling",
          category: "activity",
          label: "gentle cycling",
          description: "Gentle cycling is familiar and factual.",
          salience: 0.9,
        },
        {
          id: "solo-photo",
          category: "activity",
          label: "taking photographs of ordinary details",
          description: "This activity appears in two memories.",
          occurrenceCount: 2,
          salience: 0.86,
        },
        {
          id: "solo-design",
          category: "interest",
          label: "industrial design",
          description: "Industrial design is a factual interest.",
          salience: 0.78,
        },
        {
          id: "solo-coast",
          category: "place",
          label: "coastal paths",
          description: "Coastal paths are familiar.",
          salience: 0.74,
        },
        {
          id: "solo-quiet",
          category: "condition",
          label: "quiet environments",
          description: "Crowded environments are explicitly avoided.",
          salience: 0.88,
        },
      ],
      [
        {
          fromNodeId: "solo-photo",
          toNodeId: "solo-cycling",
          relation: "supported",
          strength: 0.58,
        },
        {
          fromNodeId: "solo-coast",
          toNodeId: "solo-cycling",
          relation: "familiar_with",
        },
        {
          fromNodeId: "solo-quiet",
          toNodeId: "solo-photo",
          relation: "supported",
        },
      ],
    ),
    context: context({
      availableCompanies: ["self"],
      generationNotes: [
        "Create a complete pack without a dead social card.",
        "Do not suggest bringing friends or depending on people the system cannot supply.",
      ],
    }),
  },
  {
    id: "research-collision",
    description:
      "A balanced graph used to test whether independent research collapses onto similar places or actions.",
    graph: graph(
      [
        {
          id: "collision-paper",
          category: "activity",
          label: "folding and binding paper",
          salience: 0.9,
        },
        {
          id: "collision-night",
          category: "condition",
          label: "late-evening energy",
          salience: 0.82,
        },
        {
          id: "collision-hills",
          category: "place",
          label: "low wooded hills",
          salience: 0.8,
        },
        {
          id: "collision-radio",
          category: "interest",
          label: "field recordings",
          salience: 0.78,
        },
      ],
      [
        {
          fromNodeId: "collision-paper",
          toNodeId: "collision-night",
          relation: "familiar_with",
        },
        {
          fromNodeId: "collision-radio",
          toNodeId: "collision-hills",
          relation: "discovered_through",
        },
      ],
    ),
    context: context({
      generationNotes: [
        "The three briefs must remain independent enough to survive a post-research collision audit.",
      ],
    }),
  },
] as const;

export function weeklyPackFixtureById(id: string) {
  return WEEKLY_PACK_FIXTURES.find((fixture) => fixture.id === id);
}

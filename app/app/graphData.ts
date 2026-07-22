import type {
  ExperienceFamiliarity,
  ExperienceNodeCategory,
  ExperiencePolarity,
  ExperienceRelation,
} from "../../lib/experienceOntology";
import { resolveOrbSizes } from "./orbSizing";
import { resolveOutwardPositions } from "./radialGrowth";

export type WorldNodeCategory = "self" | ExperienceNodeCategory;

type WorldNodeSeed = {
  key: string;
  category: WorldNodeCategory;
  subtype: string;
  label: string;
  description: string;
  evidence: string;
  certainty: "fact" | "hypothesis";
  confidence: number;
  salience: number;
  position?: readonly [number, number, number];
};

export type WorldNode = Omit<WorldNodeSeed, "position"> & {
  position: readonly [number, number, number];
  radius: number;
  major: boolean;
};

export type WorldEdge = {
  from: string;
  to: string;
  relation: ExperienceRelation;
  polarity: ExperiencePolarity;
  familiarity: ExperienceFamiliarity;
  strength: number;
  certainty: "fact" | "hypothesis";
  role?: "root" | "relation";
};

// This is a redacted, presentation-safe normalization of the first real graph
// in the development database. Nodes are concise things; typed edges carry the
// meaning that used to be buried inside sentence-shaped labels. `self` remains
// presentation-only so the world has a human centre without pretending the
// memory model produced private identity data.
const worldNodeSeeds: readonly WorldNodeSeed[] = [
  {
    key: "self",
    category: "self",
    subtype: "centre",
    label: "you",
    description:
      "The person at the centre of every memory, relationship and possibility Sidequest is beginning to understand.",
    evidence: "This world grows from the memories you choose to share.",
    certainty: "fact",
    confidence: 1,
    salience: 1,
    position: [0, 0.08, 0.35],
  },
  {
    key: "island_ride",
    category: "experience",
    subtype: "meaningful_memory",
    label: "The island ride",
    description:
      "Ninety minutes cycling through a quiet island town with close friends became one of the most meaningful experiences of your life.",
    evidence: "“It became one of the top three experiences of my life.”",
    certainty: "fact",
    confidence: 1,
    salience: 1,
    position: [2.15, 0.35, 0.05],
  },
  {
    key: "close_friends",
    category: "people",
    subtype: "close_group",
    label: "Close friends",
    description:
      "The people who made an unfamiliar place feel safe enough to explore freely.",
    evidence: "“Sharing the whole thing with people I really care about.”",
    certainty: "fact",
    confidence: 1,
    salience: 0.9,
    position: [-2.15, 1.05, 0.35],
  },
  {
    key: "cycling",
    category: "activity",
    subtype: "movement",
    label: "Cycling",
    description:
      "A movement you already loved, leaving your attention free for the place and the people around you.",
    evidence: "“The cycling itself felt familiar.”",
    certainty: "fact",
    confidence: 1,
    salience: 0.86,
    position: [-1.75, -1.55, 0.65],
  },
  {
    key: "island_setting",
    category: "place",
    subtype: "coastal_island",
    label: "An island near Fukuoka",
    description:
      "A quiet, unfamiliar seaside town that was never part of the original plan.",
    evidence: "“This strange town in Japan we didn’t even think about going to.”",
    certainty: "fact",
    confidence: 1,
    salience: 0.69,
    position: [3.05, 1.75, -0.7],
  },
  {
    key: "nostalgia",
    category: "feeling",
    subtype: "nostalgia",
    label: "Nostalgia",
    description:
      "The photographs still bring the feeling of the ride back with unusual intensity.",
    evidence: "“Whenever I look at the pictures, I feel so nostalgic.”",
    certainty: "fact",
    confidence: 1,
    salience: 0.78,
    position: [2.7, -1.25, 0.55],
  },
  {
    key: "discovery",
    category: "pattern",
    subtype: "recurring_preference",
    label: "Discovering as you go",
    description:
      "Unstructured discovery may matter more to you than arriving with a finished itinerary.",
    evidence: "“Discovering the place as we went, without much of a plan.”",
    certainty: "hypothesis",
    confidence: 0.88,
    salience: 0.72,
    position: [-2.85, 2.05, -0.45],
  },
  {
    key: "no_fixed_plan",
    category: "condition",
    subtype: "planning_style",
    label: "No fixed plan",
    description:
      "The absence of a route gave the experience room to become its own thing.",
    evidence: "The island was unplanned and unfamiliar.",
    certainty: "fact",
    confidence: 1,
    salience: 0.56,
    position: [1.4, -2.45, -0.65],
  },
  {
    key: "joy_in_movement",
    category: "feeling",
    subtype: "embodied_joy",
    label: "Joy in movement",
    description:
      "The physical rhythm of moving through the landscape may be part of what made the day feel alive.",
    evidence: "“I loved the movement.”",
    certainty: "hypothesis",
    confidence: 0.85,
    salience: 0.7,
    position: [3.15, -2, 0.65],
  },
  {
    key: "shared_presence",
    category: "feeling",
    subtype: "connection",
    label: "Shared presence",
    description:
      "Experiencing something new beside people you love may deepen how strongly it stays with you.",
    evidence: "“Doing it with close friends felt completely new.”",
    certainty: "hypothesis",
    confidence: 0.9,
    salience: 0.75,
    position: [-3.2, 0.25, -0.35],
  },
  {
    key: "familiar_made_new",
    category: "pattern",
    subtype: "transferable_pattern",
    label: "The familiar, made new",
    description:
      "Something already loved can feel completely different when the place and company change.",
    evidence: "“The cycling felt familiar, but the whole thing felt completely new.”",
    certainty: "hypothesis",
    confidence: 0.9,
    salience: 0.84,
    position: [-0.25, -2.25, 1.1],
  },
];

export const worldEdges: readonly WorldEdge[] = [
  {
    from: "self",
    to: "island_ride",
    relation: "lived",
    polarity: "positive",
    familiarity: "mixed",
    strength: 1,
    certainty: "fact",
    role: "root",
  },
  {
    from: "self",
    to: "close_friends",
    relation: "cares_about",
    polarity: "positive",
    familiarity: "familiar",
    strength: 1,
    certainty: "fact",
    role: "root",
  },
  {
    from: "self",
    to: "cycling",
    relation: "familiar_with",
    polarity: "positive",
    familiarity: "familiar",
    strength: 1,
    certainty: "fact",
    role: "root",
  },
  {
    from: "island_ride",
    to: "close_friends",
    relation: "shared_with",
    polarity: "positive",
    familiarity: "mixed",
    strength: 1,
    certainty: "fact",
  },
  {
    from: "island_ride",
    to: "cycling",
    relation: "involved",
    polarity: "positive",
    familiarity: "mixed",
    strength: 1,
    certainty: "fact",
  },
  {
    from: "island_ride",
    to: "island_setting",
    relation: "happened_at",
    polarity: "positive",
    familiarity: "new",
    strength: 0.95,
    certainty: "fact",
  },
  {
    from: "island_ride",
    to: "nostalgia",
    relation: "evoked",
    polarity: "positive",
    familiarity: "not_applicable",
    strength: 0.95,
    certainty: "fact",
  },
  {
    from: "island_ride",
    to: "no_fixed_plan",
    relation: "shaped_by",
    polarity: "positive",
    familiarity: "new",
    strength: 0.9,
    certainty: "fact",
  },
  {
    from: "no_fixed_plan",
    to: "discovery",
    relation: "supported",
    polarity: "positive",
    familiarity: "new",
    strength: 0.88,
    certainty: "hypothesis",
  },
  {
    from: "island_ride",
    to: "joy_in_movement",
    relation: "evoked",
    polarity: "positive",
    familiarity: "mixed",
    strength: 0.85,
    certainty: "hypothesis",
  },
  {
    from: "close_friends",
    to: "shared_presence",
    relation: "supported",
    polarity: "positive",
    familiarity: "mixed",
    strength: 0.9,
    certainty: "hypothesis",
  },
  {
    from: "cycling",
    to: "joy_in_movement",
    relation: "supported",
    polarity: "positive",
    familiarity: "familiar",
    strength: 0.85,
    certainty: "hypothesis",
  },
  {
    from: "island_ride",
    to: "familiar_made_new",
    relation: "reflects",
    polarity: "positive",
    familiarity: "mixed",
    strength: 0.95,
    certainty: "hypothesis",
  },
  {
    from: "cycling",
    to: "familiar_made_new",
    relation: "reinforces",
    polarity: "positive",
    familiarity: "familiar",
    strength: 0.9,
    certainty: "hypothesis",
  },
  {
    from: "island_setting",
    to: "familiar_made_new",
    relation: "reinforces",
    polarity: "positive",
    familiarity: "new",
    strength: 0.9,
    certainty: "hypothesis",
  },
  {
    from: "close_friends",
    to: "familiar_made_new",
    relation: "reinforces",
    polarity: "positive",
    familiarity: "mixed",
    strength: 0.9,
    certainty: "hypothesis",
  },
];

const sizedWorldNodes = resolveOrbSizes(worldNodeSeeds, worldEdges);

export const worldNodes: readonly WorldNode[] = resolveOutwardPositions(
  sizedWorldNodes,
  worldEdges,
);

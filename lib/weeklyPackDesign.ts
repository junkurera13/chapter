import { z } from "zod";

import type { ExperienceGraphRecord } from "./backendTypes";
import type { ExperienceNodeCategory } from "./experienceOntology";

export const WEEKLY_PACK_SCALES = ["small", "mini", "proper"] as const;
export const WEEKLY_PACK_COMPANIES = [
  "self",
  "known-person",
  "new-person",
  "small-group",
] as const;
export const WEEKLY_PACK_STRUCTURES = [
  "single-action",
  "destination",
  "journey",
  "sequence",
] as const;
export const WEEKLY_PACK_EFFORTS = [
  "spontaneous",
  "lightly-planned",
  "deliberately-planned",
] as const;
export const WEEKLY_PACK_GEOGRAPHIES = [
  "neighbourhood",
  "city",
  "beyond-city",
] as const;
export const WEEKLY_PACK_STRETCH_DIMENSIONS = [
  "place",
  "activity",
  "person",
  "time",
] as const;
export const WEEKLY_PACK_MECHANISMS = [
  "make",
  "move",
  "observe",
  "learn",
  "collect",
  "play",
  "perform",
  "help",
  "taste",
  "ritual",
  "explore",
  "tend",
] as const;
export const WEEKLY_PACK_REQUIREMENT_KINDS = [
  "availability",
  "booking",
  "cost",
  "travel",
  "route",
  "equipment",
  "accessibility",
  "weather",
  "safety",
  "capacity",
  "current-evidence",
] as const;

export type WeeklyPackScale = (typeof WEEKLY_PACK_SCALES)[number];
export type WeeklyPackCompany = (typeof WEEKLY_PACK_COMPANIES)[number];
export type WeeklyPackMechanism = (typeof WEEKLY_PACK_MECHANISMS)[number];
export type WeeklyPackStretchDimension =
  (typeof WEEKLY_PACK_STRETCH_DIMENSIONS)[number];

const scaleSchema = z.enum(WEEKLY_PACK_SCALES);
const companySchema = z.enum(WEEKLY_PACK_COMPANIES);
const stretchDimensionSchema = z.enum(WEEKLY_PACK_STRETCH_DIMENSIONS);
const familiaritySchema = z.enum(["familiar", "new"]);

export const weeklyPackFormatSchema = z.object({
  scale: scaleSchema,
  company: companySchema,
  structure: z.enum(WEEKLY_PACK_STRUCTURES),
  effort: z.enum(WEEKLY_PACK_EFFORTS),
  geography: z.enum(WEEKLY_PACK_GEOGRAPHIES),
  durationMinutes: z.object({
    min: z.number().int().min(15).max(720),
    max: z.number().int().min(15).max(720),
  }),
  energy: z.string().trim().min(3).max(100),
  timeCharacter: z.string().trim().min(3).max(100),
});

export const weeklyPackAnchorSchema = z.object({
  nodeId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(60),
});

export const weeklyPackConnectionSafetySchema = z.object({
  publicPopulatedSetting: z.boolean(),
  boundedDuration: z.boolean(),
  activityCentred: z.boolean(),
  clearArrivalPoint: z.boolean(),
  easyExit: z.boolean(),
  worthwhileWithoutConnection: z.boolean(),
  noAlcoholDependency: z.boolean(),
});

export const weeklyPackCardDesignSchema = z.object({
  id: scaleSchema,
  format: weeklyPackFormatSchema,
  primaryAnchorId: z.string().trim().min(1),
  anchors: z.array(weeklyPackAnchorSchema).min(1).max(4),
  familiarThread: z.string().trim().min(15).max(500),
  familiarity: z.object({
    place: familiaritySchema,
    activity: familiaritySchema,
    person: familiaritySchema,
    time: familiaritySchema,
  }),
  stretch: z.object({
    dimension: stretchDimensionSchema,
    description: z.string().trim().min(15).max(400),
  }),
  experiencePromise: z.string().trim().min(20).max(800),
  mechanism: z.object({
    kind: z.enum(WEEKLY_PACK_MECHANISMS),
    description: z.string().trim().min(15).max(500),
  }),
  memoryOrConnectionPotential: z.string().trim().min(15).max(500),
  requirements: z
    .array(
      z.object({
        kind: z.enum(WEEKLY_PACK_REQUIREMENT_KINDS),
        detail: z.string().trim().min(5).max(400),
      }),
    )
    .min(3)
    .max(12),
  researchObjective: z.string().trim().min(80).max(3_500),
  distinctFromOthers: z.string().trim().min(15).max(500),
  connectionSafety: weeklyPackConnectionSafetySchema.nullable(),
});

export const weeklyPackDesignSchema = z.object({
  packThesis: z.string().trim().min(20).max(800),
  cards: z.array(weeklyPackCardDesignSchema).length(3),
});

/**
 * Provider-facing shape without the many nested string/array/number bounds
 * that some structured-output engines compile into an oversized grammar.
 * Every result is parsed through `weeklyPackDesignSchema` immediately after
 * generation, so the strict local contract remains authoritative.
 */
export const weeklyPackDesignModelSchema = z.object({
  packThesis: z.string(),
  cards: z.array(
    z.object({
      id: scaleSchema,
      format: z.object({
        scale: scaleSchema,
        company: companySchema,
        structure: z.enum(WEEKLY_PACK_STRUCTURES),
        effort: z.enum(WEEKLY_PACK_EFFORTS),
        geography: z.enum(WEEKLY_PACK_GEOGRAPHIES),
        durationMinutes: z.object({
          min: z.number(),
          max: z.number(),
        }),
        energy: z.string(),
        timeCharacter: z.string(),
      }),
      primaryAnchorId: z.string(),
      anchors: z.array(
        z.object({
          nodeId: z.string(),
          label: z.string(),
          category: z.string(),
        }),
      ),
      familiarThread: z.string(),
      familiarity: z.object({
        place: familiaritySchema,
        activity: familiaritySchema,
        person: familiaritySchema,
        time: familiaritySchema,
      }),
      stretch: z.object({
        dimension: stretchDimensionSchema,
        description: z.string(),
      }),
      experiencePromise: z.string(),
      mechanism: z.object({
        kind: z.enum(WEEKLY_PACK_MECHANISMS),
        description: z.string(),
      }),
      memoryOrConnectionPotential: z.string(),
      requirements: z.array(
        z.object({
          kind: z.enum(WEEKLY_PACK_REQUIREMENT_KINDS),
          detail: z.string(),
        }),
      ),
      researchObjective: z.string(),
      distinctFromOthers: z.string(),
      connectionSafety: weeklyPackConnectionSafetySchema.nullable(),
    }),
  ),
});

export type WeeklyPackCardDesign = z.infer<
  typeof weeklyPackCardDesignSchema
>;
export type WeeklyPackDesign = z.infer<typeof weeklyPackDesignSchema>;

export type WeeklyPackContext = {
  homeCity: string;
  privacyMode: "personal" | "shareable" | "intersection";
  availableCompanies: readonly WeeklyPackCompany[];
  maxMechanismOccurrences?: Partial<
    Record<WeeklyPackMechanism, number>
  >;
  generationNotes?: readonly string[];
};

export type WeeklyPackAuditIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  cardId?: string;
};

export type WeeklyPackAudit = {
  valid: boolean;
  errors: WeeklyPackAuditIssue[];
  warnings: WeeklyPackAuditIssue[];
};

const SHAREABLE_CATEGORIES = new Set<ExperienceNodeCategory>([
  "place",
  "activity",
  "interest",
]);

type DesignDigest = ReturnType<typeof buildWeeklyPackGraphDigest>;

/**
 * A bounded graph view for design. It keeps the strength and uncertainty that
 * make restraint possible, but excludes raw evidence and memory identifiers.
 */
export function buildWeeklyPackGraphDigest(
  graph: ExperienceGraphRecord,
  maxNodes = 80,
) {
  const nodes = [...graph.nodes]
    .sort((first, second) => {
      const firstWeight = first.salience * first.confidence;
      const secondWeight = second.salience * second.confidence;
      return secondWeight - firstWeight;
    })
    .slice(0, maxNodes)
    .map((node) => ({
      id: node.id,
      category: node.category,
      subtype: node.subtype,
      label: node.label,
      description: node.description,
      certainty: node.certainty,
      confidence: Math.round(node.confidence * 100) / 100,
      salience: Math.round(node.salience * 100) / 100,
      sourceType: node.sourceType,
      linked: Boolean(node.linkedUserId),
    }));
  const includedIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges
    .filter(
      (edge) =>
        includedIds.has(edge.fromNodeId) &&
        includedIds.has(edge.toNodeId),
    )
    .map((edge) => ({
      from: edge.fromNodeId,
      to: edge.toNodeId,
      relation: edge.relation,
      polarity: edge.polarity,
      familiarity: edge.familiarity,
      strength: Math.round(edge.strength * 100) / 100,
      certainty: edge.certainty,
    }));
  return { nodes, edges };
}

function formatContract() {
  return {
    small: {
      promise: "I could actually do this soon.",
      duration: "30-90 minutes",
      structure: "one sharp action or compact ritual",
      geography: "neighbourhood or nearby city",
      effort: "spontaneous",
    },
    mini: {
      promise: "This changes the shape of an afternoon.",
      duration: "2-4 hours",
      structure: "one destination or activity with at most one natural beat",
      geography: "within the city or a modest journey",
      effort: "light preparation is acceptable",
    },
    proper: {
      promise: "This deserves a day.",
      duration: "a substantial half-day or full day",
      structure: "a coherent journey or short sequence with a clear arc",
      geography: "may reach beyond the city when travel is part of the value",
      effort: "deliberate planning is acceptable when dependencies are verified",
    },
  };
}

export function buildWeeklyPackDesignPrompt(args: {
  graph: ExperienceGraphRecord;
  context: WeeklyPackContext;
}) {
  const digest = buildWeeklyPackGraphDigest(args.graph);
  return [
    "Design one Chapter weekly pack as a single composition.",
    "This is experience design before research. Do not choose or name a venue, provider, event, route, or business yet.",
    "",
    "PRODUCT PURPOSE",
    "Chapter uses real-world experiences to help a person enter life and create conditions for human connection. Friendship or love may emerge, but you must never predict, score, or promise either.",
    "",
    "PACK CONTRACT",
    "- Return exactly three cards: one small, one mini, and one proper.",
    "- Treat scale and company as separate axes.",
    "- Give every card a different primary graph anchor, experience mechanism, and living thread.",
    "- Each card must be good enough to regret losing. Do not create one hero and two filler cards.",
    "- At most one card may be deliberately demanding.",
    "- Design the human action, rhythm, constraint, shared task, or journey. A place is supporting infrastructure, not the idea.",
    "",
    "ONE-STRETCH CONTRACT",
    "- Every card has exactly one new dimension: place, activity, person, or time.",
    "- Set that dimension to `new` in familiarity and all other dimensions to `familiar`.",
    "- Transform the familiar thread; do not literally repeat its noun.",
    "- A new-person card must spend its only stretch on `person`; place, activity, and time stay familiar.",
    "",
    "TRUTH AND PRIVACY",
    "- Anchor every card to 1-4 node ids in the supplied graph.",
    "- Prefer fact, high-confidence, high-salience, strongly connected evidence.",
    "- Never invent biography, relationships, emotional meaning, preferences, constraints, or compatibility.",
    "- Never quote or reconstruct a raw memory.",
    args.context.privacyMode === "personal"
      ? "- This is a private personal graph used only for this person's design."
      : "- This is a privacy-safe graph. You may use only place, activity, and interest nodes.",
    "",
    "SOCIAL CONTRACT",
    `- Allowed company values for this pack: ${args.context.availableCompanies.join(", ")}.`,
    "- Do not attach company decoratively. Another person must improve the mechanism itself.",
    "- New-person experiences must be public, bounded, activity-centred, easy to leave, worthwhile even if no connection forms, and independent of alcohol.",
    "- Do not expose a name, profile, one-sided fact, matching score, attraction, destiny, or supposed compatibility.",
    "",
    "RESEARCH BRIEFS",
    "- Write a separate objective for each card that proves what the designed experience needs.",
    "- Ask research to prove current availability, cost, travel, booking, safety, accessibility, weather, equipment, route, or capacity when relevant.",
    "- Do not reduce every objective to finding an unusual venue.",
    "- Do not let research redesign the experience or add another unfamiliar dimension.",
    "",
    "FORMAT CONTRACTS",
    JSON.stringify(formatContract()),
    args.context.generationNotes?.length
      ? `FIXTURE-SPECIFIC PRESSURE TESTS\n${args.context.generationNotes
          .map((note) => `- ${note}`)
          .join("\n")}`
      : "",
    "",
    `HOME CITY: ${args.context.homeCity}`,
    `PRIVACY MODE: ${args.context.privacyMode}`,
    "GRAPH DIGEST",
    JSON.stringify(digest),
  ]
    .filter(Boolean)
    .join("\n");
}

function canonicalWords(value: string) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "at",
    "for",
    "in",
    "of",
    "on",
    "the",
    "to",
    "with",
  ]);
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word)),
  );
}

function jaccard(first: string, second: string) {
  const firstWords = canonicalWords(first);
  const secondWords = canonicalWords(second);
  const union = new Set([...firstWords, ...secondWords]);
  if (union.size === 0) return 0;
  const intersection = [...firstWords].filter((word) =>
    secondWords.has(word),
  );
  return intersection.length / union.size;
}

function addIssue(
  issues: WeeklyPackAuditIssue[],
  issue: Omit<WeeklyPackAuditIssue, "severity">,
  severity: WeeklyPackAuditIssue["severity"] = "error",
) {
  issues.push({ ...issue, severity });
}

function expectedDuration(scale: WeeklyPackScale, min: number, max: number) {
  if (min > max) return false;
  if (scale === "small") return min >= 30 && max <= 90;
  if (scale === "mini") return min >= 120 && max <= 240;
  return min >= 240 && max <= 720;
}

function auditCardFormat(
  card: WeeklyPackCardDesign,
  issues: WeeklyPackAuditIssue[],
) {
  const { scale, structure, effort, geography, durationMinutes } = card.format;
  if (card.id !== scale) {
    addIssue(issues, {
      code: "CARD_ID_SCALE_MISMATCH",
      cardId: card.id,
      message: `Card id ${card.id} does not match format scale ${scale}.`,
    });
  }
  if (!expectedDuration(scale, durationMinutes.min, durationMinutes.max)) {
    addIssue(issues, {
      code: "FORMAT_DURATION",
      cardId: card.id,
      message: `${scale} duration ${durationMinutes.min}-${durationMinutes.max} minutes violates its format contract.`,
    });
  }
  if (
    scale === "small" &&
    (structure !== "single-action" ||
      effort !== "spontaneous" ||
      geography === "beyond-city")
  ) {
    addIssue(issues, {
      code: "SMALL_FORMAT",
      cardId: card.id,
      message:
        "A small card must be a spontaneous single action and cannot depend on beyond-city travel.",
    });
  }
  if (
    scale === "proper" &&
    structure !== "journey" &&
    structure !== "sequence"
  ) {
    addIssue(issues, {
      code: "PROPER_FORMAT",
      cardId: card.id,
      message: "A proper card needs a coherent journey or sequence.",
    });
  }
}

function auditStretch(
  card: WeeklyPackCardDesign,
  issues: WeeklyPackAuditIssue[],
) {
  const dimensions = WEEKLY_PACK_STRETCH_DIMENSIONS.filter(
    (dimension) => card.familiarity[dimension] === "new",
  );
  if (
    dimensions.length !== 1 ||
    dimensions[0] !== card.stretch.dimension
  ) {
    addIssue(issues, {
      code: "ONE_STRETCH",
      cardId: card.id,
      message:
        "Exactly one familiarity dimension must be new, and it must match the declared stretch.",
    });
  }
  if (
    card.format.company === "self" &&
    card.stretch.dimension === "person"
  ) {
    addIssue(issues, {
      code: "SELF_PERSON_STRETCH",
      cardId: card.id,
      message: "A self experience cannot spend its stretch on a new person.",
    });
  }
}

function auditConnection(
  card: WeeklyPackCardDesign,
  context: WeeklyPackContext,
  issues: WeeklyPackAuditIssue[],
) {
  const company = card.format.company;
  if (!context.availableCompanies.includes(company)) {
    addIssue(issues, {
      code: "COMPANY_UNAVAILABLE",
      cardId: card.id,
      message: `${company} is not available in this runtime context.`,
    });
  }

  if (company !== "new-person") return;
  if (card.stretch.dimension !== "person") {
    addIssue(issues, {
      code: "NEW_PERSON_STRETCH",
      cardId: card.id,
      message: "A new person must be the card's only stretch.",
    });
  }
  if (card.format.scale === "proper" || card.format.durationMinutes.max > 180) {
    addIssue(issues, {
      code: "NEW_PERSON_COMMITMENT",
      cardId: card.id,
      message:
        "A first meeting must stay bounded; it cannot be a proper adventure or exceed three hours.",
    });
  }
  const safety = card.connectionSafety;
  if (!safety || Object.values(safety).some((value) => value !== true)) {
    addIssue(issues, {
      code: "NEW_PERSON_SAFETY",
      cardId: card.id,
      message:
        "A new-person card must satisfy every first-meeting safety condition.",
    });
  }
}

function auditAnchors(
  card: WeeklyPackCardDesign,
  graph: ExperienceGraphRecord,
  context: WeeklyPackContext,
  issues: WeeklyPackAuditIssue[],
) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const anchorIds = new Set(card.anchors.map((anchor) => anchor.nodeId));
  if (!anchorIds.has(card.primaryAnchorId)) {
    addIssue(issues, {
      code: "PRIMARY_ANCHOR_MISSING",
      cardId: card.id,
      message: "The primary anchor must also appear in anchors.",
    });
  }
  for (const anchor of card.anchors) {
    const node = nodesById.get(anchor.nodeId);
    if (!node) {
      addIssue(issues, {
        code: "ANCHOR_UNKNOWN",
        cardId: card.id,
        message: `Anchor ${anchor.nodeId} does not exist in the graph.`,
      });
      continue;
    }
    if (
      context.privacyMode !== "personal" &&
      !SHAREABLE_CATEGORIES.has(node.category)
    ) {
      addIssue(issues, {
        code: "ANCHOR_NOT_SHAREABLE",
        cardId: card.id,
        message: `${node.category} node ${node.id} is outside the shareable cut.`,
      });
    }
    if (anchor.label !== node.label || anchor.category !== node.category) {
      addIssue(
        issues,
        {
          code: "ANCHOR_METADATA_DRIFT",
          cardId: card.id,
          message: `Anchor ${node.id} metadata will be replaced with the graph's canonical label and category.`,
        },
        "warning",
      );
    }
  }
}

/**
 * Replace model-supplied anchor metadata with graph truth and drop no ids.
 * Unknown ids stay present so the audit can reject them explicitly.
 */
export function canonicalizeWeeklyPackAnchors(
  pack: WeeklyPackDesign,
  graph: ExperienceGraphRecord,
) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    ...pack,
    cards: pack.cards.map((card) => ({
      ...card,
      anchors: card.anchors.map((anchor) => {
        const node = nodesById.get(anchor.nodeId);
        return node
          ? {
              nodeId: node.id,
              label: node.label,
              category: node.category,
            }
          : anchor;
      }),
    })),
  };
}

export function auditWeeklyPackDesign(args: {
  pack: WeeklyPackDesign;
  graph: ExperienceGraphRecord;
  context: WeeklyPackContext;
}): WeeklyPackAudit {
  const issues: WeeklyPackAuditIssue[] = [];
  const { pack, graph, context } = args;

  const scales = pack.cards.map((card) => card.format.scale);
  if (
    pack.cards.length !== 3 ||
    WEEKLY_PACK_SCALES.some(
      (scale) => scales.filter((candidate) => candidate === scale).length !== 1,
    )
  ) {
    addIssue(issues, {
      code: "PACK_SCALE_SET",
      message: "A pack must contain exactly one small, one mini, and one proper card.",
    });
  }

  for (const card of pack.cards) {
    auditCardFormat(card, issues);
    auditStretch(card, issues);
    auditConnection(card, context, issues);
    auditAnchors(card, graph, context, issues);

    const kinds = new Set(card.requirements.map((requirement) => requirement.kind));
    for (const required of ["availability", "cost", "travel"] as const) {
      if (!kinds.has(required)) {
        addIssue(issues, {
          code: "MISSING_RESEARCH_REQUIREMENT",
          cardId: card.id,
          message: `Research must explicitly prove ${required}.`,
        });
      }
    }
    if (/^\s*(go to|visit|check out)\b/i.test(card.experiencePromise)) {
      addIssue(
        issues,
        {
          code: "VENUE_FIRST_LANGUAGE",
          cardId: card.id,
          message:
            "The experience promise appears to start with a destination rather than a human action.",
        },
        "warning",
      );
    }
  }

  const primaryAnchors = pack.cards.map((card) => card.primaryAnchorId);
  if (new Set(primaryAnchors).size !== primaryAnchors.length) {
    addIssue(issues, {
      code: "PRIMARY_ANCHOR_REUSED",
      message: "Each card needs a different primary graph anchor.",
    });
  }

  const mechanisms = pack.cards.map((card) => card.mechanism.kind);
  if (new Set(mechanisms).size !== mechanisms.length) {
    addIssue(issues, {
      code: "MECHANISM_REUSED",
      message: "Each card needs a different experience mechanism.",
    });
  }

  for (const [mechanism, maximum] of Object.entries(
    context.maxMechanismOccurrences ?? {},
  )) {
    const count = mechanisms.filter((candidate) => candidate === mechanism).length;
    if (typeof maximum === "number" && count > maximum) {
      addIssue(issues, {
        code: "MECHANISM_LIMIT",
        message: `${mechanism} appears ${count} times; this context allows at most ${maximum}.`,
      });
    }
  }

  for (let first = 0; first < pack.cards.length; first += 1) {
    for (let second = first + 1; second < pack.cards.length; second += 1) {
      const firstCard = pack.cards[first];
      const secondCard = pack.cards[second];
      if (
        jaccard(firstCard.familiarThread, secondCard.familiarThread) >= 0.62
      ) {
        addIssue(
          issues,
          {
            code: "THREAD_SIMILARITY",
            message: `${firstCard.id} and ${secondCard.id} have suspiciously similar familiar threads.`,
          },
          "warning",
        );
      }
      if (
        jaccard(firstCard.experiencePromise, secondCard.experiencePromise) >=
        0.62
      ) {
        addIssue(issues, {
          code: "EXPERIENCE_COLLISION",
          message: `${firstCard.id} and ${secondCard.id} are too similar as lived experiences.`,
        });
      }
      if (
        jaccard(firstCard.researchObjective, secondCard.researchObjective) >=
        0.72
      ) {
        addIssue(issues, {
          code: "RESEARCH_BRIEF_COLLISION",
          message: `${firstCard.id} and ${secondCard.id} do not have meaningfully independent research briefs.`,
        });
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  return {
    valid: errors.length === 0,
    errors,
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}

export const weeklyPackReviewSchema = z.object({
  cardReviews: z
    .array(
      z.object({
        cardId: scaleSchema,
        hardGateFailures: z.array(z.string().trim().min(3).max(300)),
        scores: z.object({
          recognition: z.number().int().min(0).max(4),
          transformation: z.number().int().min(0).max(4),
          experienceMechanism: z.number().int().min(0).max(4),
          storyPotential: z.number().int().min(0).max(4),
          actionability: z.number().int().min(0).max(4),
          restraintAndTruth: z.number().int().min(0).max(4),
        }),
        strongestQuality: z.string().trim().min(10).max(400),
        revisionPriority: z.string().trim().min(10).max(400),
        verdict: z.enum(["accept", "reject"]),
      }),
    )
    .length(3),
  packScores: z.object({
    contrast: z.number().int().min(0).max(4),
    threadDiversity: z.number().int().min(0).max(4),
    mechanismDiversity: z.number().int().min(0).max(4),
    commitmentLadder: z.number().int().min(0).max(4),
    choiceQuality: z.number().int().min(0).max(4),
  }),
  packFailures: z.array(z.string().trim().min(3).max(400)),
  revisionPriority: z.string().trim().min(10).max(500),
  verdict: z.enum(["accept", "reject"]),
});

export const weeklyPackReviewModelSchema = z.object({
  cardReviews: z.array(
    z.object({
      cardId: scaleSchema,
      hardGateFailures: z.array(z.string()),
      scores: z.object({
        recognition: z.number(),
        transformation: z.number(),
        experienceMechanism: z.number(),
        storyPotential: z.number(),
        actionability: z.number(),
        restraintAndTruth: z.number(),
      }),
      strongestQuality: z.string(),
      revisionPriority: z.string(),
      verdict: z.enum(["accept", "reject"]),
    }),
  ),
  packScores: z.object({
    contrast: z.number(),
    threadDiversity: z.number(),
    mechanismDiversity: z.number(),
    commitmentLadder: z.number(),
    choiceQuality: z.number(),
  }),
  packFailures: z.array(z.string()),
  revisionPriority: z.string(),
  verdict: z.enum(["accept", "reject"]),
});

export type WeeklyPackReview = z.infer<typeof weeklyPackReviewSchema>;

export function enforceWeeklyPackReviewThresholds(
  review: WeeklyPackReview,
): WeeklyPackReview {
  const cardReviews = review.cardReviews.map((card) => {
    const scores = Object.values(card.scores);
    const total = scores.reduce((sum, score) => sum + score, 0);
    const rejected =
      card.hardGateFailures.length > 0 ||
      scores.some((score) => score < 3) ||
      total < 20;
    return { ...card, verdict: rejected ? "reject" : "accept" } as const;
  });
  const packRejected =
    cardReviews.some((card) => card.verdict === "reject") ||
    review.packFailures.length > 0 ||
    Object.values(review.packScores).some((score) => score < 3);
  return {
    ...review,
    cardReviews,
    verdict: packRejected ? "reject" : "accept",
  };
}

export function buildWeeklyPackReviewPrompt(args: {
  pack: WeeklyPackDesign;
  graph: ExperienceGraphRecord;
  context: WeeklyPackContext;
}) {
  const digest: DesignDigest = buildWeeklyPackGraphDigest(args.graph);
  return [
    "Act as a strict Chapter experience editor. Evaluate the designed pack; do not rewrite it and do not reward polished prose.",
    "",
    "HARD GATES",
    "- Each card anchors to real, permitted graph evidence.",
    "- Each card spends exactly one stretch.",
    "- There is no invented personal or compatibility claim.",
    "- The experience has a mechanism beyond naming a venue.",
    "- The social composition is safe and useful.",
    "- The cards are meaningfully distinct.",
    "Any hard-gate failure means rejection.",
    "",
    "CARD SCORING: 0-4 for recognition, transformation, experience mechanism, story potential, actionability, and restraint/truth.",
    "A card passes only with at least 3 in every dimension and at least 20/24 overall.",
    "",
    "PACK SCORING: 0-4 for contrast, thread diversity, mechanism diversity, commitment ladder, and choice quality.",
    "Reject one obvious winner plus filler, a venue monoculture, repeated mechanisms, or cards interchangeable after replacing place names.",
    "",
    "Do not infer facts missing from the graph. Be severe but specific.",
    `CONTEXT: ${JSON.stringify(args.context)}`,
    `GRAPH DIGEST: ${JSON.stringify(digest)}`,
    `DESIGNED PACK: ${JSON.stringify(args.pack)}`,
  ].join("\n");
}

export function buildWeeklyPackRevisionPrompt(args: {
  pack: WeeklyPackDesign;
  review: WeeklyPackReview;
  graph: ExperienceGraphRecord;
  context: WeeklyPackContext;
}) {
  const digest: DesignDigest = buildWeeklyPackGraphDigest(args.graph);
  return [
    "Revise one rejected Chapter weekly pack as a strict experience designer.",
    "Return a complete pack, not a patch, explanation, or research result.",
    "",
    "REVISION DISCIPLINE",
    "- Repair every hard-gate failure, rejected score, pack failure, and stated revision priority.",
    "- Preserve a card that already passed unless the pack-level critique requires changing it.",
    "- Keep exactly one small, one mini, and one proper card.",
    "- Keep scale and company as separate axes.",
    "- Every card must use a different primary graph anchor, mechanism, and living thread.",
    "- Every card gets exactly one unfamiliar dimension; all other familiarity dimensions stay familiar.",
    "- Do not name or choose a venue, provider, event, route, or business. Research happens later.",
    "- Do not solve actionability by adding hidden commitments, travel, equipment, skill, cost, or social demands.",
    "- Do not invent biography, preference, emotion, relationship, compatibility, or meaning.",
    "- Anchor only to supplied node ids. Copy labels and categories exactly.",
    "- Keep research objectives independent and specific to what each design needs proved.",
    "- A new-person experience must remain public, bounded, activity-centred, easy to leave, alcohol-independent, and worthwhile without a connection.",
    "",
    "QUALITY BAR",
    "- Recognition must come from graph truth, not a flattering guess.",
    "- Transformation must change how the familiar thread is lived, not merely move it to a novel place.",
    "- The mechanism must be a real action, rhythm, rule, shared task, or journey.",
    "- Story potential must emerge from participation, not theatrical copy.",
    "- The three-way choice must feel painful because all three are excellent, not because their prose is polished.",
    "",
    `CONTEXT: ${JSON.stringify(args.context)}`,
    `GRAPH DIGEST: ${JSON.stringify(digest)}`,
    `REJECTED PACK: ${JSON.stringify(args.pack)}`,
    `EDITOR REVIEW: ${JSON.stringify(args.review)}`,
  ].join("\n");
}

export const weeklyPackResearchFindingSchema = z.object({
  cardId: scaleSchema,
  workingTitle: z.string().trim().min(3).max(140),
  experienceAction: z.string().trim().min(20).max(800),
  experienceType: z.string().trim().min(3).max(120),
  primaryPlace: z
    .object({
      name: z.string().trim().min(2).max(200),
      area: z.string().trim().min(2).max(200),
      address: z.string().trim().min(3).max(300),
    })
    .nullable(),
  routeOrSequence: z.string().trim().min(10).max(1_500),
  logistics: z.object({
    availability: z.string().trim().min(5).max(800),
    booking: z.string().trim().min(3).max(800),
    cost: z.string().trim().min(3).max(800),
    travel: z.string().trim().min(5).max(800),
    equipment: z.string().trim().min(3).max(800),
    accessibility: z.string().trim().min(3).max(800),
    weather: z.string().trim().min(3).max(800),
    safety: z.string().trim().min(3).max(800),
  }),
  criticalFacts: z
    .array(
      z.object({
        claim: z.string().trim().min(5).max(600),
        sourceUrls: z.array(z.string().url()).min(1).max(5),
      }),
    )
    .min(2)
    .max(16),
  researchCaveats: z.array(z.string().trim().min(3).max(500)).max(10),
});

export type WeeklyPackResearchFinding = z.infer<
  typeof weeklyPackResearchFindingSchema
>;

export function buildWeeklyPackResearchPrompt(args: {
  card: WeeklyPackCardDesign;
  context: WeeklyPackContext;
  currentDate: string;
}) {
  return [
    "Prove one already-designed Chapter experience with current web research.",
    "Do not replace it with a recommendation and do not add a second unfamiliar dimension.",
    "Find the real place, event, route, material, timetable, class, or other infrastructure needed to make the action true and livable.",
    "",
    "RESEARCH RULES",
    `- Verify current operation and logistics as of ${args.currentDate}.`,
    "- Prove every critical claim with direct source URLs. Prefer first-party sources and recent operating evidence.",
    "- Preserve the designed action, mechanism, company, scale, and single stretch.",
    "- Reject chains, generic top-listicle choices, closed or weakly evidenced candidates, and logistics that violate the format.",
    "- Never state or infer anything about the person's biography, feelings, relationships, compatibility, or private memories.",
    "- If a requirement cannot be proved, say so in researchCaveats instead of guessing.",
    "",
    `HOME CITY: ${args.context.homeCity}`,
    `DESIGN RECORD: ${JSON.stringify(args.card)}`,
  ].join("\n");
}

export type WeeklyPackResearchAudit = WeeklyPackAudit & {
  collidingCardIds: string[];
};

function normalizeIdentity(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function auditWeeklyPackResearch(args: {
  pack: WeeklyPackDesign;
  findings: readonly WeeklyPackResearchFinding[];
}): WeeklyPackResearchAudit {
  const issues: WeeklyPackAuditIssue[] = [];
  const collidingCardIds = new Set<string>();
  const expectedIds = new Set(args.pack.cards.map((card) => card.id));
  const actualIds = args.findings.map((finding) => finding.cardId);

  for (const expectedId of expectedIds) {
    if (actualIds.filter((id) => id === expectedId).length !== 1) {
      addIssue(issues, {
        code: "RESEARCH_CARD_SET",
        cardId: expectedId,
        message: `Research must return exactly one finding for ${expectedId}.`,
      });
    }
  }

  for (let first = 0; first < args.findings.length; first += 1) {
    for (let second = first + 1; second < args.findings.length; second += 1) {
      const firstFinding = args.findings[first];
      const secondFinding = args.findings[second];
      const firstPlace = firstFinding.primaryPlace?.name;
      const secondPlace = secondFinding.primaryPlace?.name;
      if (
        firstPlace &&
        secondPlace &&
        normalizeIdentity(firstPlace) === normalizeIdentity(secondPlace)
      ) {
        collidingCardIds.add(firstFinding.cardId);
        collidingCardIds.add(secondFinding.cardId);
        addIssue(issues, {
          code: "RESEARCH_PLACE_COLLISION",
          message: `${firstFinding.cardId} and ${secondFinding.cardId} resolved to the same place.`,
        });
      }
      if (
        jaccard(firstFinding.experienceAction, secondFinding.experienceAction) >=
        0.62
      ) {
        collidingCardIds.add(firstFinding.cardId);
        collidingCardIds.add(secondFinding.cardId);
        addIssue(issues, {
          code: "RESEARCH_ACTION_COLLISION",
          message: `${firstFinding.cardId} and ${secondFinding.cardId} resolved to substantially similar actions.`,
        });
      }
    }
  }

  for (const finding of args.findings) {
    if (finding.researchCaveats.length > 0) {
      addIssue(
        issues,
        {
          code: "RESEARCH_CAVEAT",
          cardId: finding.cardId,
          message: finding.researchCaveats.join(" "),
        },
        "warning",
      );
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  return {
    valid: errors.length === 0,
    errors,
    warnings: issues.filter((issue) => issue.severity === "warning"),
    collidingCardIds: [...collidingCardIds],
  };
}

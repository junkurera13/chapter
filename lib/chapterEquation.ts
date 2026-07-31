/**
 * The Chapter Equation, as code.
 *
 *   Chapter = familiar frame + one primary unfamiliar twist
 *             + optional supporting unfamiliar context
 *
 * `docs/chapter-equation.md` is the prose; this file is the part that cannot
 * drift. Every surface that proposes a chapter should check its shape here
 * rather than restating the rules in a prompt, because a rule that lives only
 * in a prompt is a rule the model is free to forget.
 */

/**
 * The four dimensions a chapter is built out of.
 *
 * These are the parts of a real-world experience Chapter may deliberately
 * vary. The graph stores other categories too, but feelings are outcomes,
 * conditions constrain fit, patterns supply evidence, and an experience is
 * the whole rather than one coordinate inside it. Time is carried separately
 * by `timeCharacter`, `NOW_TIME_WINDOWS`, and `bestTime`.
 */
export const CHAPTER_DIMENSIONS = [
  "activity",
  "place",
  "people",
  "interest",
] as const;

export type ChapterDimension = (typeof CHAPTER_DIMENSIONS)[number];

/**
 * Who the chapter is with. Not a fifth dimension: a mode that sits above the
 * equation and decides what `people` is allowed to do.
 *
 * Kept identical to `WEEKLY_PACK_COMPANIES` so the weekly pack and the
 * equation cannot mean different things by the same word.
 */
export const CHAPTER_COMPANIES = [
  "self",
  "known-person",
  "new-person",
  "small-group",
] as const;

export type ChapterCompany = (typeof CHAPTER_COMPANIES)[number];

/**
 * What each mode does with the `people` dimension.
 *
 * `unused` sits the dimension out entirely. `anchor` spends it as the familiar
 * element, which is Together's whole architecture: the partner is the person
 * you know, so the stretch has to go somewhere else. `twist` requires people
 * to be the primary novelty, never the supporting detail, because meeting
 * someone new is not a texture you add to an evening.
 */
export const CHAPTER_COMPANY_ROLE: Record<
  ChapterCompany,
  "unused" | "anchor" | "twist"
> = {
  self: "unused",
  "known-person": "anchor",
  "new-person": "twist",
  "small-group": "twist",
};

/**
 * The mix when the person has not chosen a company for the week themselves.
 *
 * Weighted rather than uniform: solo is the most common way a life actually
 * has room for something new, and a stranger every week is a demand rather
 * than an offer. Tune here, not in prose or prompts.
 */
export const CHAPTER_COMPANY_WEIGHTS: Record<ChapterCompany, number> = {
  self: 5,
  "known-person": 2,
  "new-person": 2,
  "small-group": 1,
};

/**
 * Two layers should remain normal. A supporting unfamiliar context is useful
 * when it makes one adventure concrete, but it must not become a quota the
 * designer decorates every experience to satisfy.
 */
export const CHAPTER_LAYER_WEIGHTS = {
  two: 3,
  three: 1,
} as const;

export const CHAPTER_DIMENSION_WEIGHTS: Record<ChapterDimension, number> = {
  activity: 1,
  place: 1,
  people: 1,
  interest: 1,
};

/** The shape of a proposed chapter, before anything is written about it. */
export type ChapterShape = {
  company: ChapterCompany;
  /**
   * The dimension carrying the familiar frame. A world-led chapter may have
   * no graph-derived anchor while remaining familiar through ordinary access,
   * legibility, and low friction.
   */
  anchor?: ChapterDimension;
  /** The one dimension carrying the main emotional and practical leap. */
  twist: ChapterDimension;
  /**
   * An optional unfamiliar detail that makes the same action concrete. It is
   * legal only while subordinate to the twist and must not add an independent
   * burden, booking, skill, safety demand, or social demand.
   */
  context?: ChapterDimension;
};

/**
 * There is no "all four dimensions" issue here on purpose. Anchor plus twist
 * plus context is three by construction, so a four-layer chapter is not
 * something to reject; it is something this type cannot express.
 */
export type ChapterShapeIssue = {
  code:
    | "ANCHOR_MISSING"
    | "DIMENSION_REPEATED"
    | "PEOPLE_UNUSED"
    | "PEOPLE_MUST_ANCHOR"
    | "PEOPLE_MUST_TWIST"
    | "PEOPLE_NOT_CONTEXT";
  message: string;
};

/**
 * Whether a chapter with no familiar anchor is legal.
 *
 * A first chapter has nowhere to anchor: on `basis: "world"` the anchors array
 * is empty by design, and `familiar` takes its other meaning of locally
 * accessible, socially ordinary, and low-friction. A person Chapter has just
 * met gets a chapter built out of the world rather than a biography it does
 * not have yet.
 */
export type ChapterShapeContext = {
  /** Preferred name: world cards still have a familiar frame without graph evidence. */
  worldLed?: boolean;
  /** Backwards-compatible name for the immediate first world-led chapter. */
  coldStart?: boolean;
};

export function auditChapterShape(
  shape: ChapterShape,
  context: ChapterShapeContext = {},
): ChapterShapeIssue[] {
  const issues: ChapterShapeIssue[] = [];
  const add = (code: ChapterShapeIssue["code"], message: string) =>
    issues.push({ code, message });

  const used = [shape.anchor, shape.twist, shape.context].filter(
    (dimension): dimension is ChapterDimension => dimension !== undefined,
  );

  if (!shape.anchor && !context.worldLed && !context.coldStart) {
    add(
      "ANCHOR_MISSING",
      "A chapter needs one familiar anchor unless it is a cold-start chapter built from the world.",
    );
  }

  if (new Set(used).size !== used.length) {
    add(
      "DIMENSION_REPEATED",
      "Each dimension may be used once: anchor, twist, and context must all differ.",
    );
  }

  const role = CHAPTER_COMPANY_ROLE[shape.company];

  if (role === "unused" && used.includes("people")) {
    add(
      "PEOPLE_UNUSED",
      "A solo chapter cannot spend any layer on people.",
    );
  }

  if (role === "anchor" && shape.anchor !== "people") {
    add(
      "PEOPLE_MUST_ANCHOR",
      "With someone you know, that person is the familiar anchor and the stretch goes elsewhere.",
    );
  }

  if (role === "twist") {
    if (shape.twist !== "people") {
      add(
        "PEOPLE_MUST_TWIST",
        "Meeting someone new must be the chapter's primary stretch, not a detail attached to one.",
      );
    }
    if (shape.context === "people") {
      add(
        "PEOPLE_NOT_CONTEXT",
        "New people cannot be the supporting layer; they are the experience or they are absent.",
      );
    }
  }

  return issues;
}

type ChapterRandom = () => number;

function boundedRandom(random: ChapterRandom) {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1 - Number.EPSILON);
}

function weightedChoice<T>(
  candidates: readonly T[],
  weightFor: (candidate: T) => number,
  random: ChapterRandom,
): T {
  if (candidates.length === 0) {
    throw new Error("Cannot draw from an empty Chapter candidate set.");
  }
  const weighted = candidates.map((candidate) => ({
    candidate,
    weight: Math.max(0, weightFor(candidate)),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return candidates[0];
  let cursor = boundedRandom(random) * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.candidate;
  }
  return weighted.at(-1)!.candidate;
}

/**
 * Stable randomness makes a weekly draw reproducible across retries. The seed
 * is not security-sensitive; it only keeps the same request from changing
 * shape between design and research.
 */
export function seededChapterRandom(seed: string): ChapterRandom {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ineligible company modes are absent, not merely unlikely. This is the
 * boundary that prevents a random draw from manufacturing a person or group
 * the product cannot actually supply.
 */
export function chooseChapterCompany(args: {
  eligible: readonly ChapterCompany[];
  random: ChapterRandom;
  weights?: Partial<Record<ChapterCompany, number>>;
}): ChapterCompany {
  const eligible = CHAPTER_COMPANIES.filter((company) =>
    args.eligible.includes(company),
  );
  if (eligible.length === 0) {
    throw new Error("Chapter needs at least one eligible company mode.");
  }
  return weightedChoice(
    eligible,
    (company) => args.weights?.[company] ?? CHAPTER_COMPANY_WEIGHTS[company],
    args.random,
  );
}

/**
 * Draw only the empty grammar. Actual people, activities, places, interests,
 * events, dates, and venues must come later from the private graph or verified
 * live research.
 */
export function chooseChapterShape(args: {
  company: ChapterCompany;
  random: ChapterRandom;
  anchorCandidates?: readonly ChapterDimension[];
  twistCandidates?: readonly ChapterDimension[];
  allowContext?: boolean;
  dimensionWeights?: Partial<Record<ChapterDimension, number>>;
}): ChapterShape {
  const role = CHAPTER_COMPANY_ROLE[args.company];
  const nonPeople = CHAPTER_DIMENSIONS.filter(
    (dimension) => dimension !== "people",
  );
  const permitted = role === "unused" ? nonPeople : [...CHAPTER_DIMENSIONS];
  const suppliedAnchors = (args.anchorCandidates ?? []).filter((dimension) =>
    permitted.includes(dimension),
  );
  const anchor =
    role === "anchor"
      ? "people"
      : suppliedAnchors.length > 0
        ? weightedChoice(
            suppliedAnchors,
            (dimension) =>
              args.dimensionWeights?.[dimension] ??
              CHAPTER_DIMENSION_WEIGHTS[dimension],
            args.random,
          )
        : undefined;

  const availableTwists = (
    args.twistCandidates?.filter((dimension) =>
      permitted.includes(dimension),
    ) ?? permitted
  ).filter((dimension) => dimension !== anchor);
  const twist =
    role === "twist"
      ? "people"
      : weightedChoice(
          availableTwists,
          (dimension) =>
            args.dimensionWeights?.[dimension] ??
            CHAPTER_DIMENSION_WEIGHTS[dimension],
          args.random,
        );

  const contextCandidates = permitted.filter(
    (dimension) => dimension !== anchor && dimension !== twist,
  );
  const contextAllowed =
    args.allowContext !== false &&
    contextCandidates.length > 0;
  const context =
    contextAllowed &&
    weightedChoice(
      ["two", "three"] as const,
      (layers) => CHAPTER_LAYER_WEIGHTS[layers],
      args.random,
    ) === "three"
      ? weightedChoice(
          contextCandidates,
          (dimension) =>
            args.dimensionWeights?.[dimension] ??
            CHAPTER_DIMENSION_WEIGHTS[dimension],
          args.random,
        )
      : undefined;

  return { company: args.company, anchor, twist, context };
}

export function isLegalChapterShape(
  shape: ChapterShape,
  context: ChapterShapeContext = {},
): boolean {
  return auditChapterShape(shape, context).length === 0;
}

/**
 * Every legal shape for a company, twist and context counted as the distinct
 * jobs they are. Twelve for `self` and nine for each other company: thirty
 * role templates when the two stranger modes share one role, or 39 concrete
 * company-labelled shapes.
 *
 * Enumerated rather than asserted so the documented count stays honest: if a
 * rule above changes, the number changes with it instead of the doc quietly
 * becoming wrong.
 */
export function legalChapterShapes(
  company: ChapterCompany,
): ChapterShape[] {
  const shapes: ChapterShape[] = [];
  const candidates: (ChapterDimension | undefined)[] = [
    undefined,
    ...CHAPTER_DIMENSIONS,
  ];

  for (const anchor of CHAPTER_DIMENSIONS) {
    for (const twist of CHAPTER_DIMENSIONS) {
      for (const context of candidates) {
        const shape: ChapterShape = { company, anchor, twist, context };
        if (isLegalChapterShape(shape)) shapes.push(shape);
      }
    }
  }

  return shapes;
}

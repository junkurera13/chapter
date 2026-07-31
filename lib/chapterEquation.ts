/**
 * The Chapter Equation, as code.
 *
 *   Chapter = familiar anchor + unfamiliar twist + optional unfamiliar context
 *
 * `docs/chapter-equation.md` is the prose; this file is the part that cannot
 * drift. Every surface that proposes a chapter should check its shape here
 * rather than restating the rules in a prompt, because a rule that lives only
 * in a prompt is a rule the model is free to forget.
 */

/**
 * The four dimensions a chapter is built out of.
 *
 * These are exactly the nouns the memory graph stores as nodes, which is the
 * test for admitting a fifth: a dimension must be something a person can hold
 * a memory of. Time fails that test and is deliberately absent. Nobody
 * remembers 8am. A chapter that looks like it stretches on time is stretching
 * on the activity the hour makes possible, and time is carried separately by
 * `timeCharacter`, `NOW_TIME_WINDOWS`, and `bestTime`.
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

/** The shape of a proposed chapter, before anything is written about it. */
export type ChapterShape = {
  company: ChapterCompany;
  /** The familiar dimension. Absent on a cold-start chapter with no graph. */
  anchor?: ChapterDimension;
  /** The primary new dimension. Always present. */
  twist: ChapterDimension;
  /** The optional second new dimension, adding specificity rather than difficulty. */
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
export type ChapterShapeContext = { coldStart?: boolean };

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

  if (!shape.anchor && !context.coldStart) {
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

export function isLegalChapterShape(
  shape: ChapterShape,
  context: ChapterShapeContext = {},
): boolean {
  return auditChapterShape(shape, context).length === 0;
}

/**
 * Every legal shape for a company, twist and context counted as the distinct
 * jobs they are. Twelve for `self`, nine for each of the others, thirty in
 * total.
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

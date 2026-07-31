import { z } from "zod";

/**
 * The primary-twist dimensions for Now. Time still shapes when an experience
 * works, but it is logistics rather than something the experience is made of.
 */
export const NOW_STRETCH_DIMENSIONS = [
  "place",
  "activity",
  "person",
  "interest",
] as const;

export type NowStretchDimension = (typeof NOW_STRETCH_DIMENSIONS)[number];

/**
 * The parts of a day a person can say they are free in.
 *
 * Coarse on purpose. Someone knows they have Saturday evening long before
 * they know whether that means seven or nine, and a research brief reads
 * "evening, when the counter seats fill" better than a clock range it would
 * only have to interpret back into words.
 */
export const NOW_TIME_WINDOWS = [
  "morning",
  "afternoon",
  "evening",
  "night",
] as const;

export type NowTimeWindow = (typeof NOW_TIME_WINDOWS)[number];

export const nowTimeWindowSchema = z.enum(NOW_TIME_WINDOWS);

/**
 * The hour Chapter offers when nobody has said otherwise.
 *
 * Evening because that is when a free day is actually spent, and because a
 * default has to be a real answer: the whole point of asking nothing is that
 * the research still gets something specific to hold itself to.
 */
export const NOW_DEFAULT_WINDOW: NowTimeWindow = "evening";

/** What each window means in hours, for checking against opening times. */
export const NOW_TIME_WINDOW_HOURS: Record<NowTimeWindow, string> = {
  morning: "06:00–12:00",
  afternoon: "12:00–17:00",
  evening: "17:00–21:00",
  night: "21:00–late",
};

/**
 * How far someone will go for this one, in the only unit a city is honestly
 * measured in. Five kilometres in Seoul is twenty minutes by subway or forty
 * across the river at six, so a radius drawn in distance says nothing anyone
 * can plan around.
 *
 * These are stops rather than a dial. The research has no routing engine, so
 * it cannot honour thirty-seven minutes any more exactly than "about half an
 * hour", and each stop is a different kind of evening rather than a wider
 * circle around the same one.
 */
export const NOW_REACHES = ["walk", "near", "city", "beyond"] as const;

export type NowReach = (typeof NOW_REACHES)[number];

export const nowReachSchema = z.enum(NOW_REACHES);

/** Where the form lands when nobody has said otherwise. */
export const NOW_DEFAULT_REACH: NowReach = "near";

export const NOW_REACH: Record<
  NowReach,
  {
    /** Named on the slider, in the person's terms. */
    label: string;
    /** What that distance actually means where they live. */
    note: string;
    /** The same distance as the researcher has to act on it. */
    travel: string;
  }
> = {
  walk: {
    label: "Walkable",
    note: "Your own streets, on foot",
    travel: "a fifteen minute walk",
  },
  near: {
    label: "Half an hour",
    note: "Your side of the city",
    travel: "about thirty minutes by public transport or a short taxi",
  },
  city: {
    label: "An hour",
    note: "Anywhere in the city",
    travel: "about an hour by public transport",
  },
  beyond: {
    label: "Out past the city",
    note: "A coast town, a mountain temple",
    travel: "up to about two hours by train, bus or car",
  },
};

/** How far ahead a day can be chosen. Past that, a world has moved on. */
export const NOW_SCHEDULE_HORIZON_DAYS = 120;

export const nowAnchorSchema = z.object({
  nodeId: z.string().min(1),
  label: z.string().min(1).max(90),
  category: z.string().min(1).max(30),
});

export type NowAnchor = z.infer<typeof nowAnchorSchema>;

export const nowBriefSchema = z.object({
  basis: z.enum(["world", "graph"]).default("graph"),
  threadTitle: z.string().min(3).max(90),
  anchors: z.array(nowAnchorSchema).max(4),
  stretch: z.object({
    dimension: z.enum(NOW_STRETCH_DIMENSIONS),
    description: z.string().min(10).max(300),
  }),
  researchObjective: z.string().min(80).max(2400),
});

export type NowBrief = z.infer<typeof nowBriefSchema>;

export const nowResearchFindingSchema = z.object({
  venue_name: z.string().min(1).max(160),
  venue_area: z.string().min(1).max(160),
  address: z.string().trim().min(3).max(300),
  why_uncommon: z.string().min(1).max(1200),
  still_operating_evidence: z.string().trim().min(5).max(600),
  best_time: z.string().min(1).max(300),
  price_note: z.string().max(300).optional().nullable(),
});

export type NowResearchFinding = z.infer<typeof nowResearchFindingSchema>;

/**
 * JSON Schema handed to Parallel's Task API. The field descriptions steer the
 * research: they carry the anti-obvious constraints, so uncommonness is a
 * property of the retrieval, not a hope about the model.
 */
export const NOW_RESEARCH_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    venue_name: {
      type: "string",
      description:
        "Exact name of the single best venue, spot, or recurring event found. Must be a real, currently operating place verified from sources. Never a chain, franchise, tourist landmark, or anything that headlines top-10 listicles.",
    },
    venue_area: {
      type: "string",
      description:
        "Neighbourhood and city where it is, e.g. 'Mangwon-dong, Seoul'.",
    },
    address: {
      type: "string",
      description:
        "Verified street address from a source. If no source proves one, the research has failed.",
    },
    why_uncommon: {
      type: "string",
      description:
        "Why this find is genuinely uncommon: age, single proprietor, odd hours, hyperlocal reputation, scarcity of English/tourist coverage. Cite concrete facts from sources, not vibes.",
    },
    still_operating_evidence: {
      type: "string",
      description:
        "The most recent evidence (with date if available) that this place currently operates: a recent review, post, or listing update.",
    },
    best_time: {
      type: "string",
      description:
        "When to go, matching the brief's requested day/time window, with opening-hours reality from sources.",
    },
    price_note: {
      type: "string",
      description: "Rough cost if sources state it, else empty.",
    },
  },
  required: [
    "venue_name",
    "venue_area",
    "address",
    "why_uncommon",
    "still_operating_evidence",
    "best_time",
  ],
  additionalProperties: false,
} as const;

/**
 * One card, one line.
 *
 * There is no prose here on purpose. The paragraph this replaced was the only
 * part of a chapter nothing could check: anchors are verified against the
 * person's real graph and venue facts come back from research with citations
 * attached, but the sentences around them were free to invent a grandmother who
 * never existed, and did. A card with nowhere to put a paragraph cannot.
 *
 * `line` is the whole of what is said. It contains `activity` and `venueName`
 * verbatim so the card can find them and draw them as chips, the same contract
 * the memory anchors have always had with composed copy.
 */
export const nowComposedSchema = z.object({
  line: z.string().min(20).max(200),
  /** The thing being proposed, exactly as it reads inside `line`. */
  activity: z.string().min(2).max(70),
  /** When, exactly as it reads inside `line`. Empty when the line names no day. */
  when: z.string().max(60),
});

export type NowComposed = z.infer<typeof nowComposedSchema>;

export const nowChapterContentSchema = nowComposedSchema.extend({
  /* Both may end up empty: a chip whose string went missing from the line is
     dropped rather than drawn against nothing. */
  activity: z.string().max(70),
  when: z.string().max(60),
  /** Copied off the research finding rather than written, so it cannot drift. */
  venueName: z.string().min(1).max(160),
  venueArea: z.string().min(1).max(160),
  address: z.string().max(300).optional(),
  bestTime: z.string().min(1).max(300),
  priceNote: z.string().max(300).optional(),
  /**
   * Lifted off one of the pages the research already cited, so the photo on the
   * card is a photo of the place and not a photo of somewhere like it. Absent
   * when none of those pages carried one.
   */
  imageUrl: z.string().max(2000).optional(),
});

export type NowChapterContent = z.infer<typeof nowChapterContentSchema>;

export type NowEvidenceLink = { url: string; title?: string };

export type NowChapterRecord = {
  id: string;
  /**
   * `scheduled` is a chapter that exists as an appointment before it exists as
   * writing: the day is claimed, and the research it will be made of has not
   * been paid for yet.
   */
  status:
    | "scheduled"
    | "researching"
    | "proposed"
    | "accepted"
    | "declined"
    | "lived"
    | "failed";
  createdAt: number;
  scheduledFor?: string;
  /** The parts of the chosen day the person said they were free in. */
  timeWindows?: NowTimeWindow[];
  /** How far they said they would go for it. */
  reach?: NowReach;
  researchRunId?: string;
  brief?: NowBrief;
  content?: NowChapterContent;
  evidence?: NowEvidenceLink[];
  declineReason?: string;
};

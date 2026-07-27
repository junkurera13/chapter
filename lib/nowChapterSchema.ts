import { z } from "zod";

/**
 * The one-stretch contract: every proposed chapter keeps the person's world
 * familiar except along exactly one dimension, which reaches into the unknown.
 */
export const NOW_STRETCH_DIMENSIONS = [
  "place",
  "activity",
  "person",
  "time",
] as const;

export type NowStretchDimension = (typeof NOW_STRETCH_DIMENSIONS)[number];

export const nowAnchorSchema = z.object({
  nodeId: z.string().min(1),
  label: z.string().min(1).max(90),
  category: z.string().min(1).max(30),
});

export type NowAnchor = z.infer<typeof nowAnchorSchema>;

export const nowBriefSchema = z.object({
  threadTitle: z.string().min(3).max(90),
  anchors: z.array(nowAnchorSchema).min(1).max(4),
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
  address: z.string().max(300).optional().nullable(),
  why_uncommon: z.string().min(1).max(1200),
  still_operating_evidence: z.string().max(600).optional().nullable(),
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
      description: "Street address if the sources state one, else empty.",
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
  required: ["venue_name", "venue_area", "why_uncommon", "best_time"],
  additionalProperties: false,
} as const;

export const nowChapterContentSchema = z.object({
  title: z.string().min(3).max(64),
  invitation: z.string().min(40).max(600),
  knownLine: z.string().min(10).max(300),
  unknownLine: z.string().min(10).max(300),
  venueName: z.string().min(1).max(160),
  venueArea: z.string().min(1).max(160),
  address: z.string().max(300).optional(),
  bestTime: z.string().min(1).max(300),
  priceNote: z.string().max(300).optional(),
  whyUncommon: z.string().min(1).max(1200),
});

export type NowChapterContent = z.infer<typeof nowChapterContentSchema>;

export type NowEvidenceLink = { url: string; title?: string };

export type NowChapterRecord = {
  id: string;
  status:
    | "researching"
    | "proposed"
    | "accepted"
    | "declined"
    | "lived"
    | "failed";
  createdAt: number;
  scheduledFor?: string;
  researchRunId?: string;
  brief?: NowBrief;
  content?: NowChapterContent;
  evidence?: NowEvidenceLink[];
  declineReason?: string;
};

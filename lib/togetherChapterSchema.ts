import { z } from "zod";

import { type NowEvidenceLink } from "./nowChapterSchema";

/**
 * Together plans from two private worlds at once, so a label that was safe to
 * show one person can be a disclosure to the other. These are the node
 * categories a shared invitation may name out loud: the raw material of an
 * outing, and nothing about anyone's inner life.
 *
 * Everything else — experiences, people, feelings, conditions, patterns —
 * never reaches the cross-person prompt at all. It can shape the plan only in
 * the sense that it is absent from it.
 */
export const TOGETHER_SHAREABLE_CATEGORIES = [
  "place",
  "activity",
  "interest",
] as const;

export type TogetherShareableCategory =
  (typeof TOGETHER_SHAREABLE_CATEGORIES)[number];

export function isShareableCategory(
  category: string,
): category is TogetherShareableCategory {
  return (TOGETHER_SHAREABLE_CATEGORIES as readonly string[]).includes(
    category,
  );
}

/**
 * Wing 1 has already spent the person dimension: the partner is the familiar
 * person the chapter is built around. So the one stretch must be place,
 * activity, or time — never person.
 */
export const TOGETHER_STRETCH_DIMENSIONS = ["place", "activity", "time"] as const;

export type TogetherStretchDimension =
  (typeof TOGETHER_STRETCH_DIMENSIONS)[number];

/** What the brief model returns: labels only, never node ids it could invent. */
export const togetherBriefDraftSchema = z.object({
  threadTitle: z.string().min(3).max(90),
  anchorLabels: z.array(z.string().min(1).max(90)).min(1).max(4),
  stretch: z.object({
    dimension: z.enum(TOGETHER_STRETCH_DIMENSIONS),
    description: z.string().min(10).max(300),
  }),
  researchObjective: z.string().min(80).max(2400),
});

export type TogetherBriefDraft = z.infer<typeof togetherBriefDraftSchema>;

/**
 * An anchor after the server has resolved it back into both graphs. A node id
 * is present only for the side that actually holds that thread, which is what
 * lets each person's copy of the invitation light up only their own memories.
 */
export const togetherAnchorSchema = z.object({
  label: z.string().min(1).max(90),
  category: z.string().min(1).max(30),
  initiatorNodeId: z.string().min(1).optional(),
  partnerNodeId: z.string().min(1).optional(),
});

export type TogetherAnchor = z.infer<typeof togetherAnchorSchema>;

export const togetherBriefSchema = z.object({
  threadTitle: z.string().min(3).max(90),
  anchors: z.array(togetherAnchorSchema).min(1).max(4),
  stretch: z.object({
    dimension: z.enum(TOGETHER_STRETCH_DIMENSIONS),
    description: z.string().min(10).max(300),
  }),
  researchObjective: z.string().min(80).max(2400),
});

export type TogetherBrief = z.infer<typeof togetherBriefSchema>;

/**
 * The letter-shaped proposal, which Together still is.
 *
 * Now used to share this definition, and no longer does: its proposal is one
 * card with one line on it. Keeping a copy here is cheaper than keeping the two
 * surfaces married when they have stopped agreeing about what a proposal looks
 * like.
 */
export const togetherChapterContentSchema = z.object({
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

export type TogetherChapterContent = z.infer<
  typeof togetherChapterContentSchema
>;

export type TogetherChapterRole = "initiator" | "partner";

export type TogetherChapterStatus =
  | "researching"
  | "draft"
  | "proposed"
  | "accepted"
  | "declined"
  | "lived"
  | "failed";

/**
 * One anchor as a single person sees it. The other side's node id is stripped
 * before the record ever leaves the backend, so an anchor either belongs to
 * you — and renders as one of your orbs — or it is plain words.
 */
export type TogetherAnchorView = {
  label: string;
  category: string;
  nodeId?: string;
};

export type TogetherBriefView = {
  threadTitle: string;
  anchors: TogetherAnchorView[];
  stretch: { dimension: TogetherStretchDimension; description: string };
};

export type TogetherChapterRecord = {
  id: string;
  role: TogetherChapterRole;
  status: TogetherChapterStatus;
  /** First name of the other person, resolved server-side. */
  partnerName: string;
  connectionId: string;
  createdAt: number;
  /** The day the initiator suggested, before the partner answers. */
  proposedFor?: string;
  /** The day the partner confirmed. */
  scheduledFor?: string;
  researchRunId?: string;
  brief?: TogetherBriefView;
  content?: TogetherChapterContent;
  evidence?: NowEvidenceLink[];
  declineReason?: string;
  declinedByRole?: TogetherChapterRole;
  /** "Lived" is per person: a chapter is lived when both have said so. */
  youLived: boolean;
  theyLived: boolean;
};

export type TogetherPlanningNode = {
  id: string;
  label: string;
  category: string;
  salience: number;
};

/**
 * The partner's side of a plan, as it reaches the planner. Deliberately not
 * their graph: shareable categories only, and no edges, descriptions,
 * evidence, memory ids, or anything else a memory is actually made of. The id
 * survives only so an anchor can be resolved back to the orb its owner sees.
 */
export type TogetherPlanningGraph = {
  nodes: TogetherPlanningNode[];
};

/** What the brief model is shown: not even the ids. */
export type TogetherDigestNode = {
  label: string;
  category: string;
  salience: number;
};

export type TogetherPlanningDigest = {
  nodes: TogetherDigestNode[];
};

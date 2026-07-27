import "server-only";

import type { ExperienceGraphRecord } from "./backendTypes";
import type { NowEvidenceLink, NowResearchFinding } from "./nowChapterSchema";
import { nowResearchFindingSchema } from "./nowChapterSchema";
import { generateStructured, NowGenerationError } from "./nowGeneration";
import {
  isShareableCategory,
  type TogetherAnchor,
  type TogetherBrief,
  togetherBriefDraftSchema,
  type TogetherChapterContent,
  togetherChapterContentSchema,
  type TogetherDigestNode,
  type TogetherPlanningDigest,
  type TogetherPlanningGraph,
} from "./togetherChapterSchema";

export class TogetherGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TogetherGenerationError";
  }
}

/** Labels match across two worlds on meaning, not on typography. */
export function normalizeLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Reduces a full private graph to the part that may be spoken aloud in a
 * shared invitation: places, activities, and interests. Feelings, people,
 * conditions, patterns, and the memories themselves never leave this function.
 *
 * The partner's side arrives already reduced this way by the backend; this is
 * the same cut applied to whichever graph is held locally.
 */
export function planningGraphFrom(
  graph: ExperienceGraphRecord,
): TogetherPlanningGraph {
  return {
    nodes: graph.nodes
      .filter((node) => isShareableCategory(node.category))
      .map((node) => ({
        id: node.id,
        label: node.label,
        category: node.category,
        salience: node.salience,
      })),
  };
}

/** The prompt's view: ranked, de-duplicated, and stripped of ids. */
export function buildPlanningDigest(
  graph: TogetherPlanningGraph,
  maxNodes = 40,
): TogetherPlanningDigest {
  const nodes: TogetherDigestNode[] = [];
  const seen = new Set<string>();
  for (const node of [...graph.nodes].sort(
    (first, second) => second.salience - first.salience,
  )) {
    if (!isShareableCategory(node.category)) continue;
    const key = normalizeLabel(node.label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    nodes.push({
      label: node.label,
      category: node.category,
      salience: Math.round(node.salience * 100) / 100,
    });
    if (nodes.length >= maxNodes) break;
  }
  return { nodes };
}

/** Node ids for shareable labels, so an anchor can be resolved back to orbs. */
export function shareableNodeIdsByLabel(graph: TogetherPlanningGraph) {
  const byLabel = new Map<string, string>();
  for (const node of [...graph.nodes].sort(
    (first, second) => second.salience - first.salience,
  )) {
    if (!isShareableCategory(node.category)) continue;
    const key = normalizeLabel(node.label);
    if (key && !byLabel.has(key)) byLabel.set(key, node.id);
  }
  return byLabel;
}

export function sharedLabels(
  initiator: TogetherPlanningDigest,
  partner: TogetherPlanningDigest,
) {
  const partnerKeys = new Set(
    partner.nodes.map((node) => normalizeLabel(node.label)),
  );
  return initiator.nodes.filter((node) =>
    partnerKeys.has(normalizeLabel(node.label)),
  );
}

export function buildTogetherBriefPrompt(args: {
  initiator: TogetherPlanningDigest;
  partner: TogetherPlanningDigest;
  shared: TogetherDigestNode[];
  homeCity: string;
  partnerName: string;
  avoidVenues?: readonly string[];
}) {
  return [
    "You design one real-world experience for TWO people to live together, from what each of their private worlds already contains.",
    "",
    "THE ONE STRETCH is the product's governing rule. Here the person dimension is already spent: these two know each other, and doing this together is the familiar part. So keep the thread familiar to both and stretch EXACTLY ONE of place, activity, or time into the unknown. Never two. Never the generic.",
    "The stretch must read as a stretch for BOTH of them — not somewhere one already goes every week.",
    "",
    "DISCLOSURE RULE, absolute:",
    "- You are shown two lists. You may never reveal, hint at, or imply which list anything came from.",
    "- Never write 'you both', 'they also', 'she likes', or any phrasing that reports one person's world to the other.",
    "- The proposal must read as a plan, not as a summary of two people.",
    "- Anchors present in BOTH lists are the safest and best material. Prefer them.",
    "",
    "Write a research brief for a deep-research agent that will find one real, currently operating, genuinely uncommon venue or recurring event.",
    "The researchObjective must:",
    `- name the city and constrain the search to it: ${args.homeCity}.`,
    "- describe what to find in specific sensory terms drawn from the thread (cuisine, atmosphere, materials, sound, pace).",
    "- suit two people spending unhurried time together: seating or a shared activity, not a solo errand.",
    "- demand uncommonness: prefer old, small, family-run, single-proprietor, odd-hours, hyperlocal places; explicitly exclude chains, franchises, tourist landmarks, and anything prominent in top-10 listicles or heavy English press.",
    "- require proof the place still operates (recent reviews, posts, or listings).",
    "- state the day/time window that suits the thread.",
    args.avoidVenues && args.avoidVenues.length > 0
      ? `- exclude these previously proposed venues: ${args.avoidVenues.join("; ")}.`
      : "",
    "",
    "anchorLabels: 1-4 labels copied VERBATIM from the lists below. These are the familiar side of the proposal.",
    "",
    "IN BOTH WORLDS (prefer these)",
    JSON.stringify(args.shared.map((node) => node.label)),
    "LIST A",
    JSON.stringify(args.initiator.nodes),
    "LIST B",
    JSON.stringify(args.partner.nodes),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Stage 1 over two graphs. Anchors come back as labels and are resolved here
 * against both graphs, so a label can never carry an id the model invented and
 * can never carry the other person's id into the wrong copy of the invitation.
 */
export async function generateTogetherBrief(args: {
  initiatorGraph: TogetherPlanningGraph;
  partnerGraph: TogetherPlanningGraph;
  homeCity: string;
  partnerName: string;
  avoidVenues?: readonly string[];
  requestId: string;
  signal?: AbortSignal;
}): Promise<TogetherBrief> {
  const initiator = buildPlanningDigest(args.initiatorGraph);
  const partner = buildPlanningDigest(args.partnerGraph);
  if (initiator.nodes.length === 0) {
    throw new TogetherGenerationError(
      "Your world doesn’t have enough shareable ground yet.",
    );
  }

  const draft = await generateStructured({
    prompt: buildTogetherBriefPrompt({
      initiator,
      partner,
      shared: sharedLabels(initiator, partner),
      homeCity: args.homeCity,
      partnerName: args.partnerName,
      avoidVenues: args.avoidVenues,
    }),
    schemaName: "together_brief",
    schemaDescription:
      "A one-stretch experience thread for two people, with a deep-research objective.",
    schema: togetherBriefDraftSchema,
    requestId: args.requestId,
    signal: args.signal,
    surface: "together",
  });

  const initiatorIds = shareableNodeIdsByLabel(args.initiatorGraph);
  const partnerIds = shareableNodeIdsByLabel(args.partnerGraph);
  const categoryByLabel = new Map<string, string>();
  for (const node of [...initiator.nodes, ...partner.nodes]) {
    const key = normalizeLabel(node.label);
    if (!categoryByLabel.has(key)) categoryByLabel.set(key, node.category);
  }

  const anchors: TogetherAnchor[] = [];
  const used = new Set<string>();
  for (const label of draft.anchorLabels) {
    const key = normalizeLabel(label);
    if (!key || used.has(key)) continue;
    const initiatorNodeId = initiatorIds.get(key);
    const partnerNodeId = partnerIds.get(key);
    // A label neither world holds is a hallucination, and putting it in the
    // invitation would claim a memory that does not exist.
    if (!initiatorNodeId && !partnerNodeId) continue;
    used.add(key);
    anchors.push({
      label: label.trim(),
      category: categoryByLabel.get(key) ?? "interest",
      ...(initiatorNodeId ? { initiatorNodeId } : {}),
      ...(partnerNodeId ? { partnerNodeId } : {}),
    });
  }

  if (anchors.length === 0) {
    throw new TogetherGenerationError(
      "The brief did not anchor to either world.",
    );
  }

  return {
    threadTitle: draft.threadTitle,
    anchors,
    stretch: draft.stretch,
    researchObjective: draft.researchObjective,
  };
}

/**
 * The composed text is one artifact that both people open, so it addresses
 * "the two of you" and names neither. Naming one of them would read correctly
 * to exactly one reader and land as someone else's mail to the other — and the
 * card already says whose chapter it is.
 */
export function buildTogetherComposePrompt(args: {
  brief: TogetherComposeBrief;
  finding: NowResearchFinding;
  homeCity: string;
}) {
  return [
    "Compose one experience proposal for the Chapter app: a short letter-like invitation for two people to live one real thing together.",
    "Voice: a thoughtful friend texting. Warm, specific, unhurried. No marketing language, no exclamation marks, no emoji, no bullet points.",
    "",
    "Rules:",
    "- title: at most 7 words, no punctuation at the end.",
    "- invitation: 2-4 sentences addressed to the two of them together. It must mention each anchor label VERBATIM (exact casing) so the app can render memory orbs inline, and it must name the venue.",
    "- knownLine: one sentence starting with 'Because' explaining which thread this grew from, using anchor labels verbatim.",
    "- unknownLine: one sentence naming what is new — the single stretch.",
    "- Keep venue facts exactly as researched. Do not invent details.",
    "",
    "NAMES: never use anyone's name, and never write 'your friend' or any stand-in for one. Address them as 'the two of you' or 'you both' only in the sense of the pair being invited — never as a claim about what they share.",
    "",
    "DISCLOSURE RULE, absolute: this one text is read by both people. Never attribute any anchor, taste, or memory to one of them. Never write 'she also', 'he already', or anything that reports one person's world to the other. It is a plan they are being handed, not a description of what they have in common.",
    "",
    `HOME CITY: ${args.homeCity}`,
    "ANCHOR LABELS (use verbatim):",
    JSON.stringify(args.brief.anchors.map((anchor) => anchor.label)),
    "THE STRETCH:",
    JSON.stringify(args.brief.stretch),
    "RESEARCH FINDING (verified):",
    JSON.stringify(args.finding),
  ].join("\n");
}

/** All the composer needs: labels to weave in, and the one stretch to name. */
export type TogetherComposeBrief = {
  anchors: readonly { label: string; category: string }[];
  stretch: TogetherBrief["stretch"];
};

/** Stage 3: the verified find becomes the proposal both of them will read. */
export async function composeTogetherChapter(args: {
  brief: TogetherComposeBrief;
  researchContent: unknown;
  citations: NowEvidenceLink[];
  homeCity: string;
  requestId: string;
  signal?: AbortSignal;
}): Promise<{ content: TogetherChapterContent; evidence: NowEvidenceLink[] }> {
  const finding = nowResearchFindingSchema.safeParse(args.researchContent);
  if (!finding.success) {
    throw new TogetherGenerationError(
      "The research result did not match the expected shape.",
    );
  }

  let content: TogetherChapterContent;
  try {
    content = await generateStructured({
      prompt: buildTogetherComposePrompt({
        brief: args.brief,
        finding: finding.data,
        homeCity: args.homeCity,
      }),
      schemaName: "together_chapter",
      schemaDescription:
        "The composed Chapter proposal presented to both people.",
      schema: togetherChapterContentSchema,
      requestId: args.requestId,
      signal: args.signal,
      surface: "together",
    });
  } catch (error) {
    throw error instanceof NowGenerationError
      ? new TogetherGenerationError(error.message)
      : error;
  }

  return {
    content: {
      ...content,
      venueName: finding.data.venue_name,
      venueArea: finding.data.venue_area,
      address: finding.data.address ?? undefined,
      bestTime: finding.data.best_time,
      priceNote: finding.data.price_note ?? undefined,
      whyUncommon: finding.data.why_uncommon,
    },
    evidence: args.citations.slice(0, 4),
  };
}

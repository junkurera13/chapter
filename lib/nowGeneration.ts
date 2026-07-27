import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import type { z } from "zod";

import type { ExperienceGraphRecord } from "./backendTypes";
import {
  type NowBrief,
  nowBriefSchema,
  type NowChapterContent,
  nowChapterContentSchema,
  type NowEvidenceLink,
  type NowResearchFinding,
  nowResearchFindingSchema,
  NOW_DEFAULT_REACH,
  NOW_REACH,
  NOW_TIME_WINDOW_HOURS,
  type NowReach,
  type NowTimeWindow,
} from "./nowChapterSchema";
import { formatWeekday } from "./nowSchedule";

const NOW_MODEL_ID =
  process.env.CHAPTER_NOW_MODEL || "moonshotai/kimi-k2.6";
const NOW_FALLBACK_MODEL_ID =
  process.env.CHAPTER_NOW_FALLBACK_MODEL || "deepseek/deepseek-v4-flash";
/**
 * For calls a person is sitting and waiting on. Reasoning about where two
 * people should spend an afternoon deserves the larger model; writing one
 * sentence about what they already have in common does not, and Together
 * opens at the speed of whichever model writes it.
 */
const CHAPTER_QUICK_MODEL_ID =
  process.env.CHAPTER_QUICK_MODEL || "deepseek/deepseek-v4-flash";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  compatibility: "strict",
  appName: "Chapter",
  appUrl: "https://usechapter.vercel.app",
  extraBody: {
    provider: {
      allow_fallbacks: true,
      data_collection: "deny",
      require_parameters: true,
      zdr: true,
    },
  },
});

export class NowGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NowGenerationError";
  }
}

type DigestNode = {
  id: string;
  category: string;
  label: string;
  salience: number;
  certainty: string;
};

/** Compact, bounded view of the graph the brief model reasons over. */
export function buildGraphDigest(graph: ExperienceGraphRecord, maxNodes = 60) {
  const nodes: DigestNode[] = [...graph.nodes]
    .sort((first, second) => second.salience - first.salience)
    .slice(0, maxNodes)
    .map((node) => ({
      id: node.id,
      category: node.category,
      label: node.label,
      salience: Math.round(node.salience * 100) / 100,
      certainty: node.certainty,
    }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges
    .filter(
      (edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId),
    )
    .map((edge) => ({
      from: edge.fromNodeId,
      to: edge.toNodeId,
      relation: edge.relation,
    }));
  return { nodes, edges };
}

/**
 * The day someone set aside, written the way a researcher can act on it: the
 * weekday decides whether a place is even open, and the window decides which
 * hours of it to prove. A schedule that never reached the brief would be a
 * calendar entry; this is what makes it change what gets found.
 */
function whenClause(scheduledFor?: string, timeWindows?: readonly NowTimeWindow[]) {
  if (!scheduledFor) return "";
  const windows = timeWindows ?? [];
  const hours = windows
    .map((window) => `${window} (${NOW_TIME_WINDOW_HOURS[window]})`)
    .join(" or ");
  return [
    `- BE OPEN AND WORTH GOING TO on ${formatWeekday(scheduledFor)} ${scheduledFor}${
      hours ? `, during: ${hours}` : ""
    }.`,
    "  This is fixed. Verify the opening hours cover it from a source; if the best candidate is closed then, find a different one rather than moving the day.",
    windows.length > 0
      ? `  Let the window shape the find, not just filter it: what is worth doing at ${windows[0]} is not what is worth doing at another hour.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * How far someone will travel is not a filter laid over the answer, it is the
 * scale the whole search happens at.
 *
 * A fifteen minute walk forces the hyperlocal, which is where the good ones
 * are: the single-proprietor, odd-hours, no-English-signage places only exist
 * at neighbourhood scale, and a search that cannot leave those streets has to
 * find them. Two hours out has to say plainly that it means somewhere else,
 * or it returns the same city again with a looser bound on it.
 */
function reachClause(homeCity: string, reach: NowReach) {
  const { travel } = NOW_REACH[reach];
  if (reach === "beyond") {
    return [
      `- START from ${homeCity} and deliberately reach past it: the find must lie within ${travel} of there, and must NOT be in ${homeCity} itself.`,
      "  Somewhere that is a journey in its own right — a coast town, a mountain village, a valley temple — and say how it is reached.",
    ].join("\n");
  }
  if (reach === "walk") {
    return [
      `- CONSTRAIN the search to within ${travel} of ${homeCity}.`,
      "  This is a neighbourhood-scale search. The answer is a door on those streets, not a better place across the city, and somewhere further away is a wrong answer however good it is.",
    ].join("\n");
  }
  return `- CONSTRAIN the search to within ${travel} of ${homeCity}. Somewhere further away is a wrong answer, however good it is.`;
}

export function buildBriefPrompt(args: {
  graph: ExperienceGraphRecord;
  homeCity: string;
  avoidVenues?: readonly string[];
  declineReason?: string;
  /** The day already set aside, when this chapter grew out of a schedule. */
  scheduledFor?: string;
  timeWindows?: readonly NowTimeWindow[];
  reach?: NowReach;
}) {
  const digest = buildGraphDigest(args.graph);
  const when = whenClause(args.scheduledFor, args.timeWindows);
  return [
    "You design one real-world experience proposal from a private memory graph.",
    "The product rule is THE ONE STRETCH: pick one living thread of this person's world (their most salient people, activities, places, feelings), keep everything about it familiar, and stretch EXACTLY ONE dimension into the unknown (an unfamiliar place, an unfamiliar activity, an unfamiliar time-of-life ritual, or doing a familiar thing with a different familiar person). Never stretch two dimensions. Never propose the generic.",
    "",
    "Write a research brief for a deep-research agent that will find one real, currently operating, genuinely uncommon venue or recurring event.",
    "The researchObjective must:",
    reachClause(args.homeCity, args.reach ?? NOW_DEFAULT_REACH),
    "- describe what to find in specific sensory terms drawn from the thread (cuisine, atmosphere, materials, sound, pace).",
    "- demand uncommonness: prefer old, small, family-run, single-proprietor, odd-hours, hyperlocal places; explicitly exclude chains, franchises, tourist landmarks, and anything prominent in top-10 listicles or heavy English press.",
    "- require proof the place still operates (recent reviews, posts, or listings).",
    when || "- state the day/time window that suits the thread.",
    args.avoidVenues && args.avoidVenues.length > 0
      ? `- exclude these previously proposed venues: ${args.avoidVenues.join("; ")}.`
      : "",
    args.declineReason
      ? `The person declined the previous proposal because: "${args.declineReason}". Choose a different stretch that answers that objection.`
      : "",
    "",
    "anchors must reference real node ids from the graph digest (the familiar side of the proposal). 1-4 anchors.",
    "",
    "GRAPH DIGEST (private)",
    JSON.stringify(digest),
  ]
    .filter(Boolean)
    .join("\n");
}

function anchorsExistingIn(graph: ExperienceGraphRecord, brief: NowBrief) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const anchors = brief.anchors.flatMap((anchor) => {
    const node = byId.get(anchor.nodeId);
    return node
      ? [{ nodeId: node.id, label: node.label, category: node.category }]
      : [];
  });
  return anchors;
}

/**
 * One structured model call with a fallback model behind it. Shared with
 * Together, which runs the same two-stage pipeline over two graphs.
 */
export async function generateStructured<T>(args: {
  prompt: string;
  schemaName: string;
  schemaDescription: string;
  schema: z.ZodType<T>;
  requestId: string;
  signal?: AbortSignal;
  /** Log surface, so Together's calls are legible in the same stream. */
  surface?: "now" | "together";
  /** Someone is watching a spinner for this one. Write it with the fast model. */
  quick?: boolean;
}): Promise<T> {
  const surface = args.surface ?? "now";
  if (!process.env.OPENROUTER_API_KEY) {
    throw new NowGenerationError("OPENROUTER_API_KEY is not configured.");
  }
  const modelIds = args.quick
    ? [CHAPTER_QUICK_MODEL_ID, NOW_MODEL_ID]
    : [NOW_MODEL_ID, NOW_FALLBACK_MODEL_ID];
  for (const [attempt, modelId] of modelIds.entries()) {
    const startedAt = Date.now();
    try {
      const result = await generateText({
        model: openrouter(modelId),
        messages: [{ role: "user", content: args.prompt }],
        output: Output.object({
          name: args.schemaName,
          description: args.schemaDescription,
          schema: args.schema,
        }),
        reasoning: "none",
        temperature: 0.4,
        maxOutputTokens: 3_000,
        maxRetries: 0,
        timeout: { totalMs: 45_000 },
        abortSignal: args.signal,
      });
      const value = args.schema.parse(result.output);
      console.info(`[${surface}:generate] structured call completed`, {
        requestId: args.requestId,
        schemaName: args.schemaName,
        attempt: attempt + 1,
        model: modelId,
        elapsedMs: Date.now() - startedAt,
      });
      return value;
    } catch (error) {
      console.warn(`[${surface}:generate] structured call failed`, {
        requestId: args.requestId,
        schemaName: args.schemaName,
        attempt: attempt + 1,
        model: modelId,
        elapsedMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
  throw new NowGenerationError(
    `Chapter could not complete ${args.schemaName}.`,
  );
}

/** Stage 1: pick the thread, the single stretch, and write the research brief. */
export async function generateNowBrief(args: {
  graph: ExperienceGraphRecord;
  homeCity: string;
  avoidVenues?: readonly string[];
  declineReason?: string;
  scheduledFor?: string;
  timeWindows?: readonly NowTimeWindow[];
  reach?: NowReach;
  requestId: string;
  signal?: AbortSignal;
}): Promise<NowBrief> {
  const brief = await generateStructured({
    prompt: buildBriefPrompt(args),
    schemaName: "now_brief",
    schemaDescription:
      "A one-stretch experience thread with a deep-research objective.",
    schema: nowBriefSchema,
    requestId: args.requestId,
    signal: args.signal,
  });

  const anchors = anchorsExistingIn(args.graph, brief);
  if (anchors.length === 0) {
    throw new NowGenerationError(
      "The brief did not anchor to real graph nodes.",
    );
  }
  return { ...brief, anchors };
}

export function buildComposePrompt(args: {
  brief: NowBrief;
  finding: NowResearchFinding;
  homeCity: string;
  scheduledFor?: string;
  timeWindows?: readonly NowTimeWindow[];
}) {
  const windows = args.timeWindows ?? [];
  return [
    "Compose one experience proposal for the Chapter app: a short letter-like invitation built from this person's own world plus one verified real-world find.",
    "Voice: a thoughtful friend texting. Warm, specific, unhurried. No marketing language, no exclamation marks, no emoji, no bullet points.",
    "",
    "Rules:",
    "- title: at most 7 words, no punctuation at the end.",
    "- invitation: 2-4 sentences. It must mention each anchor label VERBATIM (exact casing) so the app can render the person's memory orbs inline, and it must name the venue.",
    "- knownLine: one sentence starting with 'Because' explaining which thread of their world this grew from, using anchor labels verbatim.",
    "- unknownLine: one sentence naming what is new — the single stretch.",
    "- Keep venue facts exactly as researched. Do not invent details.",
    args.scheduledFor
      ? "- The day is already settled: name it plainly, in the tone of a plan being confirmed rather than a date being suggested. Never offer an alternative day or ask when they are free."
      : "",
    "",
    `HOME CITY: ${args.homeCity}`,
    args.scheduledFor
      ? `THE DAY THEY SET ASIDE: ${formatWeekday(args.scheduledFor)} ${args.scheduledFor}${
          windows.length > 0 ? `, ${windows.join(" or ")}` : ""
        }`
      : "",
    "ANCHOR LABELS (use verbatim):",
    JSON.stringify(args.brief.anchors.map((anchor) => anchor.label)),
    "THE STRETCH:",
    JSON.stringify(args.brief.stretch),
    "RESEARCH FINDING (verified):",
    JSON.stringify(args.finding),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Stage 3: turn the verified research finding into the chapter proposal. */
export async function composeNowChapter(args: {
  brief: NowBrief;
  researchContent: unknown;
  citations: NowEvidenceLink[];
  homeCity: string;
  scheduledFor?: string;
  timeWindows?: readonly NowTimeWindow[];
  requestId: string;
  signal?: AbortSignal;
}): Promise<{ content: NowChapterContent; evidence: NowEvidenceLink[] }> {
  const finding = nowResearchFindingSchema.safeParse(args.researchContent);
  if (!finding.success) {
    throw new NowGenerationError(
      "The research result did not match the expected shape.",
    );
  }

  const content = await generateStructured({
    prompt: buildComposePrompt({
      brief: args.brief,
      finding: finding.data,
      homeCity: args.homeCity,
      scheduledFor: args.scheduledFor,
      timeWindows: args.timeWindows,
    }),
    schemaName: "now_chapter",
    schemaDescription:
      "The composed Chapter proposal presented to the person.",
    schema: nowChapterContentSchema,
    requestId: args.requestId,
    signal: args.signal,
  });

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

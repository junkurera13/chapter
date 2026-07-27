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
} from "./nowChapterSchema";

const NOW_MODEL_ID =
  process.env.CHAPTER_NOW_MODEL || "moonshotai/kimi-k2.6";
const NOW_FALLBACK_MODEL_ID =
  process.env.CHAPTER_NOW_FALLBACK_MODEL || "deepseek/deepseek-v4-flash";

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

export function buildBriefPrompt(args: {
  graph: ExperienceGraphRecord;
  homeCity: string;
  avoidVenues?: readonly string[];
  declineReason?: string;
}) {
  const digest = buildGraphDigest(args.graph);
  return [
    "You design one real-world experience proposal from a private memory graph.",
    "The product rule is THE ONE STRETCH: pick one living thread of this person's world (their most salient people, activities, places, feelings), keep everything about it familiar, and stretch EXACTLY ONE dimension into the unknown (an unfamiliar place, an unfamiliar activity, an unfamiliar time-of-life ritual, or doing a familiar thing with a different familiar person). Never stretch two dimensions. Never propose the generic.",
    "",
    "Write a research brief for a deep-research agent that will find one real, currently operating, genuinely uncommon venue or recurring event.",
    "The researchObjective must:",
    `- name the city and constrain the search to it: ${args.homeCity}.`,
    "- describe what to find in specific sensory terms drawn from the thread (cuisine, atmosphere, materials, sound, pace).",
    "- demand uncommonness: prefer old, small, family-run, single-proprietor, odd-hours, hyperlocal places; explicitly exclude chains, franchises, tourist landmarks, and anything prominent in top-10 listicles or heavy English press.",
    "- require proof the place still operates (recent reviews, posts, or listings).",
    "- state the day/time window that suits the thread.",
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

async function generateStructured<T>(args: {
  prompt: string;
  schemaName: string;
  schemaDescription: string;
  schema: z.ZodType<T>;
  requestId: string;
  signal?: AbortSignal;
}): Promise<T> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new NowGenerationError("OPENROUTER_API_KEY is not configured.");
  }
  const modelIds = [NOW_MODEL_ID, NOW_FALLBACK_MODEL_ID];
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
      console.info("[now:generate] structured call completed", {
        requestId: args.requestId,
        schemaName: args.schemaName,
        attempt: attempt + 1,
        model: modelId,
        elapsedMs: Date.now() - startedAt,
      });
      return value;
    } catch (error) {
      console.warn("[now:generate] structured call failed", {
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
}) {
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

/** Stage 3: turn the verified research finding into the chapter proposal. */
export async function composeNowChapter(args: {
  brief: NowBrief;
  researchContent: unknown;
  citations: NowEvidenceLink[];
  homeCity: string;
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

import "server-only";

import { generateStructured, NowGenerationError } from "./nowGeneration";
import type {
  TogetherDigestNode,
  TogetherPlanningGraph,
} from "./togetherChapterSchema";
import {
  buildPlanningDigest,
  normalizeLabel,
  shareableNodeIdsByLabel,
} from "./togetherGeneration";
import {
  type TogetherGist,
  type TogetherGistAnchor,
  togetherGistDraftSchema,
} from "./togetherGistSchema";

/** Three threads is a sentence. Four is a list, and a list is not a gist. */
const MAX_ANCHORS = 3;

export type TogetherGistThread = {
  connectionId: string;
  partnerName: string;
  anchors: TogetherGistAnchor[];
};

/**
 * The labels both worlds hold, ranked by how much they matter to the two
 * people put together, resolved back to the reader's own node ids.
 *
 * Only the intersection survives. A label one side holds alone is not a
 * gist and never leaves this function.
 */
export function findGistAnchors(args: {
  mine: TogetherPlanningGraph;
  theirs: TogetherPlanningGraph;
}): TogetherGistAnchor[] {
  const mine = buildPlanningDigest(args.mine);
  const theirs = buildPlanningDigest(args.theirs);
  const theirsByKey = new Map<string, TogetherDigestNode>();
  for (const node of theirs.nodes) {
    const key = normalizeLabel(node.label);
    if (key && !theirsByKey.has(key)) theirsByKey.set(key, node);
  }

  const myNodeIds = shareableNodeIdsByLabel(args.mine);
  const shared: Array<{ anchor: TogetherGistAnchor; weight: number }> = [];
  for (const node of mine.nodes) {
    const key = normalizeLabel(node.label);
    const match = theirsByKey.get(key);
    if (!match) continue;
    shared.push({
      anchor: {
        label: node.label,
        category: node.category,
        ...(myNodeIds.get(key) ? { nodeId: myNodeIds.get(key) } : {}),
      },
      weight: node.salience + match.salience,
    });
  }

  return shared
    .sort((first, second) => second.weight - first.weight)
    .slice(0, MAX_ANCHORS)
    .map((entry) => entry.anchor);
}

/**
 * Accounts that get sample gists alongside whatever is real. The tab is the
 * hardest thing in Chapter to demo — it needs two graphs that overlap — so one
 * account is allowed to see the shape of it before the pool exists.
 */
export function demoAccounts(): string[] {
  return (process.env.CHAPTER_DEMO_ACCOUNTS ?? "parkjundk@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isDemoAccount(email: string | undefined) {
  return Boolean(email && demoAccounts().includes(email.trim().toLowerCase()));
}

/**
 * Three sample gists from the Fukuoka crew, written the way the model writes
 * them. The anchors carry ids so they render as orbs — the point of a sample
 * is to show what a real one looks like — but the connection ids are marked,
 * so nothing downstream can mistake one for a person you can actually plan with.
 */
export function demoGists(): TogetherGist[] {
  return [
    {
      connectionId: "demo:samuel",
      partnerName: "Samuel",
      line: "You and Samuel both know the feeling of cycling around Mojiko.",
      anchors: [
        { label: "cycling", category: "activity", nodeId: "demo:cycling" },
        { label: "Mojiko", category: "place", nodeId: "demo:mojiko" },
      ],
      demo: true,
    },
    {
      connectionId: "demo:daniel",
      partnerName: "Daniel",
      line: "You and Daniel both treat ramen in Hakata as the end of a night, never the start.",
      anchors: [
        { label: "ramen", category: "interest", nodeId: "demo:ramen" },
        { label: "Hakata", category: "place", nodeId: "demo:hakata" },
      ],
      demo: true,
    },
    {
      connectionId: "demo:aron",
      partnerName: "Aron",
      line: "You and Aron both know the patience film photography asks for.",
      anchors: [
        {
          label: "film photography",
          category: "interest",
          nodeId: "demo:film",
        },
      ],
      demo: true,
    },
  ];
}

function joinLabels(labels: readonly string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * What Chapter says when the model can't be reached. Plainer than a written
 * line, and still true — which is the only bar a fallback has to clear.
 */
export function fallbackGistLine(thread: TogetherGistThread) {
  return `You and ${thread.partnerName} both know ${joinLabels(
    thread.anchors.map((anchor) => anchor.label),
  )}.`;
}

export function buildGistPrompt(threads: readonly TogetherGistThread[]) {
  return [
    "You write one sentence per pair of people. Each sentence names the one thing their two worlds turn out to share.",
    "",
    "Voice: a friend who noticed something, saying it once. Warm, plain, unhurried. Present tense.",
    "",
    "Rules for every line:",
    "- ONE sentence. At most 20 words. Ends in a full stop.",
    "- Address the reader as 'You' and name the other person.",
    "- Every label listed for that pair must appear VERBATIM (exact wording and casing) inside the sentence.",
    "- Name the felt, human thing the labels have in common — the pull of the place, the habit, the appetite. Not a summary of two profiles.",
    "- Never write 'both like', 'both enjoy', 'shared interest', 'you have in common', or anything that reads as a match percentage.",
    "- Never suggest doing anything, never name a venue, never ask a question, never use an exclamation mark or emoji.",
    "",
    "Example of the register, for a pair whose labels are [\"cycling\", \"Mojiko\"]:",
    "You and Samuel both know the feeling of cycling around Mojiko.",
    "",
    "Return one entry per pair below, keyed by its index.",
    JSON.stringify(
      threads.map((thread, index) => ({
        index,
        otherPerson: thread.partnerName,
        labels: thread.anchors.map((anchor) => anchor.label),
      })),
    ),
  ].join("\n");
}

/**
 * One call for every pair at once. The lines are read by one person about
 * people they already know, so batching costs no privacy and saves the page
 * from opening at the speed of the slowest of N round trips.
 */
export async function generateGistLines(args: {
  threads: readonly TogetherGistThread[];
  requestId: string;
  signal?: AbortSignal;
}): Promise<TogetherGist[]> {
  const threads = args.threads.filter((thread) => thread.anchors.length > 0);
  if (threads.length === 0) return [];

  let lines = new Map<number, string>();
  try {
    const draft = await generateStructured({
      prompt: buildGistPrompt(threads),
      schemaName: "together_gists",
      schemaDescription:
        "One sentence per pair naming the thread their two worlds share.",
      schema: togetherGistDraftSchema,
      requestId: args.requestId,
      signal: args.signal,
      surface: "together",
    });
    lines = new Map(draft.lines.map((entry) => [entry.index, entry.line.trim()]));
  } catch (error) {
    // A gist that can't be written is still a gist that is true.
    console.error("[together:gists] generation failed", {
      requestId: args.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      detail: error instanceof NowGenerationError ? error.message : undefined,
    });
  }

  return threads.map((thread, index) => {
    const written = lines.get(index);
    const line = written && written.length >= 12
      ? written
      : fallbackGistLine(thread);
    return {
      connectionId: thread.connectionId,
      partnerName: thread.partnerName,
      // An orb may only light up on a label the sentence actually contains.
      // Anything else would leave a dot floating beside words it doesn't name.
      anchors: thread.anchors.filter((anchor) => line.includes(anchor.label)),
      line,
    };
  });
}

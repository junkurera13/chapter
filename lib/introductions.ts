import "server-only";

import {
  type IntroductionAnchor,
  introductionLineDraftSchema,
} from "./introductionSchema";
import { generateStructured, NowGenerationError } from "./nowGeneration";

export type IntroductionThread = {
  otherUserId: string;
  anchors: IntroductionAnchor[];
  weight: number;
};

export type WrittenIntroduction = IntroductionThread & { line: string };

export const INTRODUCTION_PERSON_TOKEN = "[[PERSON]]";

function joinLabels(labels: readonly string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * What Chapter says when the model can't be reached. Plainer than a written
 * line, and still true, which is the only bar a fallback has to clear.
 */
export function fallbackIntroductionLine(
  thread: IntroductionThread,
  _city: string,
) {
  void _city;
  return `${INTRODUCTION_PERSON_TOKEN} also knows ${joinLabels(
    thread.anchors.map((anchor) => anchor.label),
  )}.`;
}

/**
 * The introduction voice, with identity represented by a literal token.
 *
 * The model never receives either person's identity. The server replaces the
 * token with the correct partner name separately for each reader.
 */
export function buildIntroductionPrompt(
  threads: readonly IntroductionThread[],
  _city: string,
) {
  void _city;
  return [
    "You write one sentence per pair of people who have never met. Each sentence names the one thing their two worlds turn out to share.",
    "",
    "Voice: a friend who noticed something, saying it once. Warm, plain, unhurried. Present tense.",
    "",
    "Rules for every line:",
    "- ONE sentence. At most 20 words. Ends in a full stop.",
    `- Include the exact token ${INTRODUCTION_PERSON_TOKEN} once. It will be replaced with the person's name after writing.`,
    "- Never invent a name, guess a gender, or refer to the person with a pronoun.",
    "- Every label listed for that pair must appear VERBATIM (exact wording and casing) inside the sentence.",
    "- Name the felt, human thing the labels have in common: the pull of the place, the habit, the appetite. Not a summary of two profiles.",
    "- Never write 'both like', 'both enjoy', 'shared interest', 'match', 'in common', or anything that reads as a compatibility score.",
    "- Never state a number, never suggest doing anything, never name a venue, never ask a question, never use an exclamation mark or emoji.",
    "- Never mention either person's city or location unless it is one of the supplied shared labels.",
    "",
    "Example of the register, for a pair whose labels are [\"cycling\", \"Mojiko\"]:",
    `${INTRODUCTION_PERSON_TOKEN} knows the feeling of cycling around Mojiko too.`,
    "",
    "Return one entry per pair below, keyed by its index.",
    JSON.stringify(
      threads.map((thread, index) => ({
        index,
        labels: thread.anchors.map((anchor) => anchor.label),
      })),
    ),
  ].join("\n");
}

/**
 * One call for every candidate at once. The model receives only shared labels
 * and a person token; Base44 attaches each first name after writing. Batching
 * therefore costs no graph privacy and avoids opening at the speed of the
 * slowest of N round trips.
 */
export async function writeIntroductionLines(args: {
  threads: readonly IntroductionThread[];
  city: string;
  requestId: string;
  signal?: AbortSignal;
}): Promise<WrittenIntroduction[]> {
  const threads = args.threads.filter((thread) => thread.anchors.length > 0);
  if (threads.length === 0) return [];

  let lines = new Map<number, string>();
  try {
    const draft = await generateStructured({
      prompt: buildIntroductionPrompt(threads, args.city),
      schemaName: "chapter_introductions",
      schemaDescription:
        "One sentence per pair of strangers naming the thread their two worlds share.",
      schema: introductionLineDraftSchema,
      requestId: args.requestId,
      signal: args.signal,
      surface: "together",
      // The same one-sentence job as a gist, on the same open-the-tab path.
      quick: true,
    });
    lines = new Map(draft.lines.map((entry) => [entry.index, entry.line.trim()]));
  } catch (error) {
    // An introduction that can't be written is still an introduction that is true.
    console.error("[together:introductions] generation failed", {
      requestId: args.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      detail: error instanceof NowGenerationError ? error.message : undefined,
    });
  }

  return threads.map((thread, index) => {
    const written = lines.get(index);
    const line = written && written.length >= 12
      ? written
      : fallbackIntroductionLine(thread, args.city);
    const safeLine = line.includes(INTRODUCTION_PERSON_TOKEN)
      ? line
      : fallbackIntroductionLine(thread, args.city);
    return {
      ...thread,
      // An orb may only light up on a label the sentence actually contains.
      // Anything else would leave a dot floating beside words it doesn't name.
      anchors: thread.anchors.filter((anchor) => safeLine.includes(anchor.label)),
      line: safeLine,
    };
  });
}

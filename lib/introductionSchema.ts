import { z } from "zod";

/**
 * An introduction is a gist about someone you have not met.
 *
 * It carries strictly less than a connected gist does. A gist between friends
 * may name the friend, because you already know them. An introduction may name
 * nobody: no name, no face, no city beyond the one you are already standing in,
 * and no count of how well you supposedly match. What is left is one sentence
 * made only of things your own world already holds, which is the reason it can
 * be shown to you before either of you has agreed to anything.
 */
export type IntroductionAnchor = {
  label: string;
  category: string;
  /** Resolved against the reader's own graph, so their memories still glow. */
  nodeId?: string;
};

export type IntroductionRecord = {
  id: string;
  /** One sentence, true in both worlds, naming neither person. */
  line: string;
  anchors: IntroductionAnchor[];
  /**
   * `offered` until this reader answers, then `waiting`. It never reports what
   * the other person did, so the state is only ever about the reader.
   */
  state: "offered" | "waiting";
  expiresAt: number;
};

/**
 * There is no `optedIn` here, and that is the design.
 *
 * Nothing about you reaches a stranger's screen: what reaches it is a sentence
 * made of what they already hold, which happens to also be true of you. So
 * there is nothing to opt into, only something to stop, and `muted` is that.
 */
export type IntroductionsState = {
  muted: boolean;
  homeCity: string;
  introductions: IntroductionRecord[];
};

export type IntroductionAnswer = {
  connected: boolean;
  closed: boolean;
  connectionId?: string;
  friendName?: string;
};

/** What the model returns: a line per candidate, addressed by position. */
export const introductionLineDraftSchema = z.object({
  lines: z
    .array(
      z.object({
        index: z.number().int().min(0).max(7),
        line: z.string().min(12).max(220),
      }),
    )
    .min(1)
    .max(8),
});

export type IntroductionLineDraft = z.infer<typeof introductionLineDraftSchema>;

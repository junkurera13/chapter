import { z } from "zod";

/**
 * A gist is the one thing two private worlds turn out to hold in common,
 * said out loud in a sentence.
 *
 * It is deliberately narrower than what Together plans with. Planning reads a
 * whole shareable graph server-side and reveals none of it; a gist reveals
 * exactly the intersection — labels this person already has in their own world
 * — and never a fact only the other person holds. Learning that someone you
 * already know also knows Mojiko is symmetric: the same sentence is true, and
 * safe, on both sides.
 */
export type TogetherGistAnchor = {
  label: string;
  category: string;
  /** Present when the reader's own world holds this thread, so it can glow. */
  nodeId?: string;
};

export type TogetherGist = {
  connectionId: string;
  partnerName: string;
  anchors: TogetherGistAnchor[];
  /** One sentence about the two of them. Contains every anchor verbatim. */
  line: string;
};

export type TogetherGistsState = {
  gists: TogetherGist[];
};

/** What the model returns: a line per thread, addressed by position. */
export const togetherGistDraftSchema = z.object({
  lines: z
    .array(
      z.object({
        index: z.number().int().min(0).max(31),
        line: z.string().min(12).max(220),
      }),
    )
    .min(1)
    .max(32),
});

export type TogetherGistDraft = z.infer<typeof togetherGistDraftSchema>;

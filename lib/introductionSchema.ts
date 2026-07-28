import { z } from "zod";

/**
 * An introduction is a gist about someone you have not met.
 *
 * It names the other person, but its sentence is still made only from the
 * strict intersection of two shareable graphs. The message request is the
 * consent boundary: no conversation or People node exists until it is accepted.
 */
export type IntroductionAnchor = {
  label: string;
  category: string;
  /** Resolved against the reader's own graph, so their memories still glow. */
  nodeId?: string;
};

export type IntroductionRecord = {
  id: string;
  partnerName: string;
  /** One sentence, true in both worlds, naming the other person. */
  line: string;
  anchors: IntroductionAnchor[];
  state: "ready" | "sent" | "received";
  /** Only returned to the recipient of the opening message. */
  openingMessage?: string;
  expiresAt: number;
};

export type IntroductionsState = {
  muted: boolean;
  introductions: IntroductionRecord[];
};

export type IntroductionMessageAnswer = {
  connected: boolean;
  closed: boolean;
  connectionId?: string;
  friendName?: string;
};

export type HumanMessageRecord = {
  id: string;
  sender: "me" | "them";
  text: string;
  createdAt: number;
};

export type HumanConversationRecord = {
  connectionId: string;
  partnerName: string;
  messages: HumanMessageRecord[];
};

export type HumanConversationsState = {
  conversations: HumanConversationRecord[];
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

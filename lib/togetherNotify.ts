import "server-only";

import { getSidequestiMessageAdapter } from "./sidequestBot";

/**
 * Chapter reaching out first.
 *
 * Everything else in the iMessage path answers a message someone sent. A
 * together-chapter can't work that way: a proposal that waits for its
 * recipient to happen to open the app is a proposal nobody answers. The Photon
 * adapter can cold-start a conversation with a number it has never heard from,
 * which is what this uses.
 *
 * Delivery is best-effort by design. The chapter is already saved by the time
 * this runs, and the card is waiting in the app either way — a failed text
 * must never fail the send.
 */
export async function sendTogetherPing(args: {
  phone?: string;
  text: string;
  requestId: string;
}) {
  const phone = args.phone?.trim();
  if (!phone) return { delivered: false, reason: "no phone" as const };

  try {
    const adapter = getSidequestiMessageAdapter();
    const threadId = await adapter.openDM(phone);
    await adapter.postMessage(threadId, args.text);
    console.info("[together:notify] ping delivered", {
      requestId: args.requestId,
    });
    return { delivered: true as const };
  } catch (error) {
    console.error("[together:notify] ping failed", {
      requestId: args.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return { delivered: false, reason: "send failed" as const };
  }
}

/** The text a partner gets when a chapter is sent to them. */
export function proposalPingText(args: {
  senderName: string;
  title: string;
  proposedFor: string;
}) {
  return [
    `${args.senderName} planned something for the two of you.`,
    `${args.title} — ${friendlyDate(args.proposedFor)}.`,
    "It's waiting in Chapter whenever you want to look.",
  ].join(" ");
}

/** The text an initiator gets when their partner answers. */
export function answerPingText(args: {
  partnerName: string;
  accepted: boolean;
  scheduledFor?: string;
}) {
  return args.accepted
    ? `${args.partnerName} is in. ${args.scheduledFor ? friendlyDate(args.scheduledFor) : "It's on"}.`
    : `${args.partnerName} can't make that one. Chapter can find another angle when you're ready.`;
}

function friendlyDate(iso: string) {
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

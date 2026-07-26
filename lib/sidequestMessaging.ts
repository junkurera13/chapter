import "server-only";

import { runSidequestTurn } from "./sidequestAgent";
import {
  beginMessage,
  completeMessage,
  markMessageDelivered,
} from "./sidequestAgentBackend";

export type MessageResult = {
  reply: string | null;
  replyId?: string;
  duplicate?: boolean;
};

export async function processSidequestMessage(args: {
  phone?: string;
  authUserId?: string;
  text: string;
  messageId: string;
  threadId?: string;
  channel?: "imessage" | "web";
  accessToken?: string;
  origin?: string;
}): Promise<MessageResult> {
  const { accessToken, origin, ...message } = args;
  const prepared = await beginMessage(message, accessToken);
  if (prepared.status === "complete") {
    return {
      reply: prepared.reply,
      replyId: prepared.replyId,
      duplicate: prepared.duplicate,
    };
  }

  const channel = message.channel === "web" ? "web" : "imessage";
  const turn = await runSidequestTurn({
    authUserId: prepared.user.authUserId,
    phone: prepared.user.phone,
    channel,
    text: message.text,
    origin,
    session: prepared.session,
    context: {
      name: prepared.user.name,
      onboardingStep: prepared.user.onboardingStep,
      notes: prepared.user.notes,
    },
  });
  const completed = await completeMessage(
    {
      authUserId: message.authUserId,
      phone: message.phone,
      messageId: message.messageId,
      threadId: message.threadId,
      channel,
      reply: turn.reply,
      session: turn.session,
    },
    accessToken,
  );
  return {
    reply: completed.reply,
    replyId: completed.replyId,
    duplicate: completed.duplicate,
  };
}

export function markSidequestMessageDelivered(args: {
  replyId: string;
  providerMessageId?: string;
}) {
  return markMessageDelivered(args);
}

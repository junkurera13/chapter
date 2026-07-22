import "server-only";

import { createMemoryState } from "@chat-adapter/state-memory";
import { createiMessageAdapter } from "@photon-ai/chat-adapter-imessage";
import { Chat } from "chat";

import {
  markSidequestMessageDelivered,
  processSidequestMessage,
} from "./sidequestMessaging";

type SidequestBot = Chat<
  { imessage: ReturnType<typeof createiMessageAdapter> },
  Record<string, unknown>
>;

let bot: SidequestBot | undefined;

async function retry<T>(operation: () => Promise<T>, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export function getSidequestBot() {
  if (bot) return bot;

  const projectId =
    process.env.IMESSAGE_PROJECT_ID ?? process.env.PHOTON_PROJECT_ID;
  const projectSecret =
    process.env.IMESSAGE_PROJECT_SECRET ?? process.env.PHOTON_PROJECT_SECRET;
  const adapter = createiMessageAdapter({
    projectId,
    projectSecret,
    webhookSecret: process.env.IMESSAGE_WEBHOOK_SECRET,
  });

  bot = new Chat({
    userName: "sidequest",
    adapters: { imessage: adapter },
    state: createMemoryState(),
  });

  bot.onDirectMessage(async (thread, message) => {
    const phone = message.author.userId.trim();
    const text = message.text.trim();
    if (!phone) throw new Error("iMessage webhook did not include a sender phone");

    if (!text) {
      await thread.post("send that to me as text for now.");
      return;
    }

    const result = await retry(() =>
      processSidequestMessage({
        phone,
        text,
        messageId: message.id,
        threadId: thread.id,
      }),
    );
    if (!result.reply || !result.replyId) return;

    const sent = await thread.post(result.reply);
    try {
      await retry(() =>
        markSidequestMessageDelivered({
          replyId: result.replyId!,
          providerMessageId: sent.id,
        }),
      );
    } catch (error) {
      console.error("Could not mark the Sidequest reply delivered", error);
    }
  });

  return bot;
}

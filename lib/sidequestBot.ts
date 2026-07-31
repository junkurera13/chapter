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

type SidequestDirectThread = {
  id: string;
  post(message: string): Promise<{ id: string }>;
};

type SidequestDirectMessage = {
  id: string;
  text: string;
  author: { userId: string };
  raw?: unknown;
};

let bot: SidequestBot | undefined;
let imessageAdapter: ReturnType<typeof createiMessageAdapter> | undefined;

/**
 * The iMessage adapter on its own, memoized alongside the bot.
 *
 * The Chat instance keeps its adapters private, and Together needs to reach
 * one directly: a chapter proposal has to start a conversation rather than
 * answer one. The adapter builds its transport on demand, so it works here
 * without the bot's webhook ever having run.
 */
export function getSidequestiMessageAdapter() {
  if (!imessageAdapter) {
    imessageAdapter = createiMessageAdapter({
      projectId: process.env.IMESSAGE_PROJECT_ID ?? process.env.PHOTON_PROJECT_ID,
      projectSecret:
        process.env.IMESSAGE_PROJECT_SECRET ?? process.env.PHOTON_PROJECT_SECRET,
      webhookSecret: process.env.IMESSAGE_WEBHOOK_SECRET,
    });
  }
  return imessageAdapter;
}

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

function inboundMetadata(message: SidequestDirectMessage) {
  const raw =
    message.raw && typeof message.raw === "object"
      ? (message.raw as Record<string, unknown>)
      : undefined;
  const content =
    raw?.content && typeof raw.content === "object"
      ? (raw.content as Record<string, unknown>)
      : undefined;

  return {
    messageId: message.id,
    direction: typeof raw?.direction === "string" ? raw.direction : "unknown",
    contentType: typeof content?.type === "string" ? content.type : "unknown",
  };
}

export async function handleSidequestDirectMessage(
  thread: SidequestDirectThread,
  message: SidequestDirectMessage,
) {
  const phone = message.author.userId.trim();
  const text = message.text.trim();
  if (!phone) throw new Error("iMessage webhook did not include a sender phone");

  // Photon can add new non-text content arms without a breaking release. Do
  // not answer those events: replying to an empty event can create a provider
  // feedback loop and send the same fallback repeatedly.
  if (!text) {
    console.warn("Ignored unsupported iMessage content", inboundMetadata(message));
    return;
  }

  const result = await retry(() =>
    processSidequestMessage({
      phone,
      text,
      messageId: message.id,
      threadId: thread.id,
      origin:
        process.env.SIDEQUEST_AGENT_URL ||
        process.env.VERCEL_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
    }),
  );
  if (!result.reply || !result.replyId || result.duplicate) return;

  const sent = await thread.post(result.reply);
  try {
    await retry(() =>
      markSidequestMessageDelivered({
        replyId: result.replyId!,
        providerMessageId: sent.id,
      }),
    );
  } catch (error) {
    console.error("Could not mark the Chapter reply delivered", error);
  }
}

export function getSidequestBot() {
  if (bot) return bot;

  const adapter = getSidequestiMessageAdapter();

  bot = new Chat({
    userName: "chapter",
    adapters: { imessage: adapter },
    state: createMemoryState(),
  });

  bot.onDirectMessage(handleSidequestDirectMessage);

  return bot;
}

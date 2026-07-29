import { createHmac } from "node:crypto";

import { createMemoryState } from "@chat-adapter/state-memory";
import { createiMessageAdapter } from "@photon-ai/chat-adapter-imessage";
import { Chat } from "chat";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drives the real Photon adapter with a real signed Spectrum Cloud delivery so
 * the inbound half of the iMessage path is exercised end to end: signature
 * verification, payload decoding, DM routing, and the sender handle the bot
 * hands to Base44. Only the outbound send is stubbed — that is Photon's gRPC
 * transport, not Chapter's code.
 */

const WEBHOOK_SECRET = "whsec_test_secret";
const DM_CHAT_GUID = "iMessage;-;+821012345678";
const LINE = "+18885550000";

function signedRequest(body: unknown, secret = WEBHOOK_SECRET) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;

  return new Request("https://chapter.test/api/imessage/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-spectrum-event": "messages",
      "x-spectrum-timestamp": timestamp,
      "x-spectrum-signature": signature,
    },
    body: rawBody,
  });
}

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    event: "messages",
    space: { id: DM_CHAT_GUID, phone: LINE },
    message: {
      id: "msg-1",
      direction: "inbound",
      timestamp: new Date().toISOString(),
      sender: { id: "+821012345678", __platform: "imessage" },
      content: { type: "text", text: "Hey" },
      ...overrides,
    },
  };
}

function buildBot(onDm: (phone: string, text: string) => Promise<string | null>) {
  const posted: string[] = [];
  const adapter = createiMessageAdapter({
    projectId: "proj_test",
    projectSecret: "secret_test",
    webhookSecret: WEBHOOK_SECRET,
  });

  // The only stubs are Photon's network edges: building the Spectrum Cloud app
  // and the outbound send. Everything between them is the real adapter.
  vi.spyOn(adapter, "initialize").mockImplementation(async (chat) => {
    (adapter as unknown as { chat: unknown }).chat = chat;
  });
  vi.spyOn(adapter, "postMessage").mockImplementation(async (_threadId, message) => {
    posted.push(typeof message === "string" ? message : JSON.stringify(message));
    return { id: "provider-msg-1" } as never;
  });

  const bot = new Chat({
    userName: "chapter",
    adapters: { imessage: adapter },
    state: createMemoryState(),
  });

  const seen: Array<{ phone: string; text: string; messageId: string }> = [];
  bot.onDirectMessage(async (thread, message) => {
    const phone = message.author.userId.trim();
    const text = message.text.trim();
    seen.push({ phone, text, messageId: message.id });
    const reply = await onDm(phone, text);
    if (reply) await thread.post(reply);
  });

  return { bot, adapter, posted, seen };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("iMessage webhook pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes a signed inbound DM to the bot and sends the reply back", async () => {
    const { bot, posted, seen } = buildBot(async () => "welcome to chapter.");

    const tasks: Promise<unknown>[] = [];
    const response = await bot.webhooks.imessage(signedRequest(delivery()), {
      waitUntil: (task) => {
        tasks.push(task);
      },
    });

    expect(response.status).toBe(200);
    await Promise.all(tasks);
    await settle();

    expect(seen).toEqual([
      { phone: "+821012345678", text: "Hey", messageId: "msg-1" },
    ]);
    expect(posted).toEqual(["welcome to chapter."]);
  });

  it("rejects a delivery signed with the wrong secret", async () => {
    const { bot, seen } = buildBot(async () => "should not run");

    const response = await bot.webhooks.imessage(
      signedRequest(delivery(), "whsec_wrong"),
      { waitUntil: () => {} },
    );

    expect(response.status).toBe(401);
    await settle();
    expect(seen).toEqual([]);
  });

  it("ignores Chapter's own outbound echo", async () => {
    const { bot, seen } = buildBot(async () => "should not run");

    const response = await bot.webhooks.imessage(
      signedRequest(delivery({ direction: "outbound" })),
      { waitUntil: () => {} },
    );

    expect(response.status).toBe(200);
    await settle();
    expect(seen).toEqual([]);
  });

  it("surfaces the raw sender handle, whatever shape Photon sends", async () => {
    const { bot, seen } = buildBot(async () => null);

    const tasks: Promise<unknown>[] = [];
    await bot.webhooks.imessage(
      signedRequest(
        delivery({
          id: "msg-2",
          sender: { id: "chapter.tester@icloud.com", __platform: "imessage" },
        }),
      ),
      {
        waitUntil: (task) => {
          tasks.push(task);
        },
      },
    );
    await Promise.all(tasks);
    await settle();

    expect(seen.map((entry) => entry.phone)).toEqual([
      "chapter.tester@icloud.com",
    ]);
  });
});

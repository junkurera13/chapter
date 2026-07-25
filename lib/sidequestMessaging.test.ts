import { beforeEach, describe, expect, it, vi } from "vitest";

import { markSidequestMessageDelivered, processSidequestMessage } from "./sidequestMessaging";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SIDEQUEST_INTERNAL_SECRET", "test-secret");
});

describe("processSidequestMessage", () => {
  it("threads authUserId, channel, and bearer into the webhook payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        value: { reply: "I’ve got it.", replyId: "msg_123" },
      }),
    );

    const result = await processSidequestMessage({
      authUserId: "user_abc",
      text: "I climbed Acadia last summer.",
      messageId: "ext_1",
      threadId: "thread_1",
      channel: "web",
      accessToken: "token-xyz",
    });

    expect(result).toEqual({ reply: "I’ve got it.", replyId: "msg_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/sidequest-message");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-xyz");
    const body = JSON.parse(init.body as string);
    expect(body.authUserId).toBe("user_abc");
    expect(body.channel).toBe("web");
    expect(body.text).toBe("I climbed Acadia last summer.");
    expect(body.internalSecret).toBeDefined();
  });

  it("falls back to the unauthed iMessage path when no auth user id is supplied", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { value: { reply: null, duplicate: true } }),
    );

    const result = await processSidequestMessage({
      phone: "+14155550143",
      text: "Hey",
      messageId: "ext_2",
    });

    expect(result).toEqual({ reply: null, duplicate: true });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    const body = JSON.parse(init.body as string);
    expect(body.channel).toBeUndefined();
    expect(body.authUserId).toBeUndefined();
  });

  it("throws when the function returns an error payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: "viewer mismatch" }),
    );

    await expect(
      processSidequestMessage({
        authUserId: "user_a",
        text: "hi",
        messageId: "ext_3",
        channel: "web",
        accessToken: "t",
      }),
    ).rejects.toThrow("viewer mismatch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("markSidequestMessageDelivered", () => {
  it("marks the reply as delivered with an optional provider message id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { value: { delivered: true } }),
    );

    const result = await markSidequestMessageDelivered({
      replyId: "msg_123",
      providerMessageId: "pmsg_456",
    });

    expect(result).toEqual({ delivered: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.action).toBe("markDelivered");
    expect(body.replyId).toBe("msg_123");
    expect(body.providerMessageId).toBe("pmsg_456");
  });
});
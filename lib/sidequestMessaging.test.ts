import { beforeEach, describe, expect, it, vi } from "vitest";

import { markSidequestMessageDelivered, processSidequestMessage } from "./sidequestMessaging";

const runSidequestTurn = vi.hoisted(() => vi.fn());

vi.mock("./sidequestAgent", () => ({ runSidequestTurn }));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  runSidequestTurn.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SIDEQUEST_INTERNAL_SECRET", "test-secret");
});

describe("processSidequestMessage", () => {
  it("prepares in Base44, runs Eve, then durably completes the reply", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          value: {
            status: "ready",
            user: {
              id: "sq_1",
              authUserId: "user_abc",
              onboardingStep: "memory_ready",
            },
            session: { streamIndex: 0 },
          },
        }),
      )
      .mockResolvedValueOnce(
      jsonResponse(200, {
          value: {
            status: "complete",
            reply: "That Acadia climb sounds vivid.",
            replyId: "msg_123",
          },
        }),
      );
    runSidequestTurn.mockResolvedValueOnce({
      reply: "That Acadia climb sounds vivid.",
      session: {
        sessionId: "ses_1",
        continuationToken: "eve:1",
        streamIndex: 12,
      },
    });

    const result = await processSidequestMessage({
      authUserId: "user_abc",
      text: "I climbed Acadia last summer.",
      messageId: "ext_1",
      threadId: "thread_1",
      channel: "web",
      accessToken: "token-xyz",
      origin: "https://chapter.example",
    });

    expect(result).toEqual({
      reply: "That Acadia climb sounds vivid.",
      replyId: "msg_123",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(runSidequestTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: "user_abc",
        channel: "web",
        origin: "https://chapter.example",
      }),
    );

    const [beginUrl, beginInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(beginUrl).toContain("/functions/sidequest-message");
    const headers = beginInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-xyz");
    const beginBody = JSON.parse(beginInit.body as string);
    expect(beginBody.action).toBe("begin");
    expect(beginBody.authUserId).toBe("user_abc");
    expect(beginBody.channel).toBe("web");
    expect(beginBody.text).toBe("I climbed Acadia last summer.");
    expect(beginBody.internalSecret).toBeDefined();

    const completeBody = JSON.parse(
      fetchMock.mock.calls[1][1].body as string,
    );
    expect(completeBody.action).toBe("complete");
    expect(completeBody.reply).toBe("That Acadia climb sounds vivid.");
    expect(completeBody.session.sessionId).toBe("ses_1");
  });

  it("returns a previously completed duplicate without calling Eve", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        value: {
          status: "complete",
          reply: null,
          duplicate: true,
        },
      }),
    );

    const result = await processSidequestMessage({
      phone: "+14155550143",
      text: "Hey",
      messageId: "ext_2",
    });

    expect(result).toEqual({ reply: null, duplicate: true });
    expect(runSidequestTurn).not.toHaveBeenCalled();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    const body = JSON.parse(init.body as string);
    expect(body.action).toBe("begin");
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

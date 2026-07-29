import { describe, expect, it, vi } from "vitest";

import { publishRealtimeInboxEvent } from "../../shared/realtime-inbox.ts";

describe("realtime inbox signals", () => {
  it("publishes only the recipient and event kind", async () => {
    const create = vi.fn(async () => ({ id: "event-1" }));

    await expect(
      publishRealtimeInboxEvent(
        { create },
        {
          recipientAuthUserId: " auth-recipient ",
          kind: "human_message",
          createdAt: 123,
        },
      ),
    ).resolves.toBe(true);

    expect(create).toHaveBeenCalledWith({
      recipient_auth_user_id: "auth-recipient",
      kind: "human_message",
      created_at: 123,
    });
    expect(Object.keys(create.mock.calls[0]?.[0] ?? {})).toEqual([
      "recipient_auth_user_id",
      "kind",
      "created_at",
    ]);
  });

  it("does not publish when the recipient has no linked auth account", async () => {
    const create = vi.fn();

    await expect(
      publishRealtimeInboxEvent(
        { create },
        {
          recipientAuthUserId: " ",
          kind: "human_message",
          createdAt: 123,
        },
      ),
    ).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("fails open when realtime is unavailable", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi.fn(async () => {
      throw new Error("entity not deployed");
    });

    await expect(
      publishRealtimeInboxEvent(
        { create },
        {
          recipientAuthUserId: "auth-recipient",
          kind: "human_message",
          createdAt: 123,
        },
      ),
    ).resolves.toBe(false);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});

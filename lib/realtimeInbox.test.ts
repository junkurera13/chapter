import { readFileSync } from "node:fs";

import type { RealtimeEvent } from "@base44/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const subscribe = vi.hoisted(() => vi.fn());

vi.mock("./base44BrowserClient", () => ({
  getBase44BrowserClient: () => ({
    entities: {
      RealtimeInboxEvent: { subscribe },
    },
  }),
}));

type TestEvent = RealtimeEvent<{
  recipient_auth_user_id: string;
  kind: "human_message";
  created_at: number;
}>;

describe("subscribeToRealtimeInbox", () => {
  beforeEach(() => {
    subscribe.mockReset();
    vi.resetModules();
  });

  it("refreshes only for a newly created human-message signal", async () => {
    let listener: ((event: TestEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    subscribe.mockImplementation((callback) => {
      listener = callback;
      return unsubscribe;
    });
    const onHumanMessage = vi.fn();
    const { subscribeToRealtimeInbox } = await import("./realtimeInbox");

    const stop = subscribeToRealtimeInbox(onHumanMessage);
    listener?.({
      type: "update",
      id: "event-1",
      timestamp: "2026-07-29T00:00:00Z",
      data: {
        recipient_auth_user_id: "viewer",
        kind: "human_message",
        created_at: 1,
      },
    });
    listener?.({
      type: "create",
      id: "event-2",
      timestamp: "2026-07-29T00:00:01Z",
      data: {
        recipient_auth_user_id: "viewer",
        kind: "human_message",
        created_at: 2,
      },
    });

    expect(onHumanMessage).toHaveBeenCalledOnce();
    expect(stop).toBe(unsubscribe);
  });
});

describe("RealtimeInboxEvent access rules", () => {
  it("contains no message content and is readable only by its recipient or admin", () => {
    const source = readFileSync(
      new URL("../base44/entities/realtime-inbox-event.jsonc", import.meta.url),
      "utf8",
    );
    const schema = JSON.parse(source.replace(/,\s*([}\]])/g, "$1")) as {
      properties: Record<string, unknown>;
      rls: Record<string, unknown>;
    };

    expect(Object.keys(schema.properties)).toEqual([
      "recipient_auth_user_id",
      "kind",
      "created_at",
    ]);
    expect(schema.rls.read).toEqual({
      $or: [
        { "data.recipient_auth_user_id": "{{user.id}}" },
        { user_condition: { role: "admin" } },
      ],
    });
    expect(schema.rls.create).toEqual({
      user_condition: { role: "admin" },
    });
  });
});

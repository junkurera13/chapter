import { describe, expect, it } from "vitest";

import {
  publicWeeklyPackStatus,
  redactLockedWeeklyPack,
} from "./weeklyPackState";
import type { WeeklyExperiencePack } from "./weeklyPackSchema";

describe("weekly pack release state", () => {
  const releaseAt = Date.UTC(2026, 6, 25, 0);
  const expiresAt = Date.UTC(2026, 7, 15, 0);

  it("keeps a ready pack locked until its release instant", () => {
    expect(
      publicWeeklyPackStatus({
        storedStatus: "ready",
        releaseAt,
        expiresAt,
        now: releaseAt - 1,
      }),
    ).toBe("locked");
  });

  it("opens it at release and expires it after the validity window", () => {
    expect(
      publicWeeklyPackStatus({
        storedStatus: "ready",
        releaseAt,
        expiresAt,
        now: releaseAt,
      }),
    ).toBe("available");
    expect(
      publicWeeklyPackStatus({
        storedStatus: "ready",
        releaseAt,
        expiresAt,
        now: expiresAt,
      }),
    ).toBe("expired");
  });

  it("preserves lived as history after the validity window", () => {
    expect(
      publicWeeklyPackStatus({
        storedStatus: "lived",
        releaseAt,
        expiresAt,
        now: expiresAt + 1,
      }),
    ).toBe("lived");
  });

  it("removes every card-shaped secret from a locked response", () => {
    const pack = {
      id: "pack-1",
      weekKey: "2026-07-25",
      status: "locked",
      releaseAt,
      expiresAt,
      cards: [
        { id: "small" },
        { id: "mini" },
        { id: "proper" },
      ],
      revealedCardIds: ["small"],
      chosenCardId: "small",
      scheduledFor: "2026-07-28",
    } as unknown as WeeklyExperiencePack;

    expect(redactLockedWeeklyPack(pack)).toEqual({
      id: "pack-1",
      weekKey: "2026-07-25",
      status: "locked",
      releaseAt,
      expiresAt,
      cards: undefined,
      revealedCardIds: [],
      chosenCardId: undefined,
      scheduledFor: undefined,
    });
  });
});

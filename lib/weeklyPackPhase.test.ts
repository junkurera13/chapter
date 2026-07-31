import { describe, expect, it } from "vitest";

import { weeklyPackReviewFixture } from "./weeklyPackPreview";
import { weeklyPackPhase } from "./weeklyPackPhase";

describe("weekly pack live phase mapping", () => {
  it("uses the locked design when a user does not have a pack yet", () => {
    expect(
      weeklyPackPhase({
        state: { status: "ready", pack: null },
        openedPackId: null,
        pendingChoice: null,
        showDatePicker: false,
      }),
    ).toBe("locked");
  });

  it("shows the error design instead of an incomplete card layout", () => {
    const fixture = weeklyPackReviewFixture("sealed");
    if (fixture.state.status !== "ready" || !fixture.state.pack) {
      throw new Error("The sealed fixture must contain a pack.");
    }

    expect(
      weeklyPackPhase({
        state: {
          status: "ready",
          pack: { ...fixture.state.pack, cards: undefined },
        },
        openedPackId: fixture.state.pack.id,
        pendingChoice: null,
        showDatePicker: false,
      }),
    ).toBe("error");
  });
});

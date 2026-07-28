import { describe, expect, it } from "vitest";

import { weeklyExperiencePackSchema } from "./weeklyPackSchema";
import {
  WEEKLY_PACK_REVIEW_STATES,
  weeklyPackReviewFixture,
  weeklyPackReviewStateFrom,
} from "./weeklyPackPreview";

describe("weekly pack UI review fixtures", () => {
  it("keeps every state addressable by a stable URL value", () => {
    const ids = WEEKLY_PACK_REVIEW_STATES.map((state) => state.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(weeklyPackReviewStateFrom(id)).toBe(id);
    }
    expect(weeklyPackReviewStateFrom("available")).toBeUndefined();
    expect(weeklyPackReviewStateFrom(undefined)).toBeUndefined();
  });

  it("uses valid public pack data in every pack-backed state", () => {
    for (const { id } of WEEKLY_PACK_REVIEW_STATES) {
      const fixture = weeklyPackReviewFixture(id);
      if (fixture.state.status !== "ready" || !fixture.state.pack) continue;

      expect(
        weeklyExperiencePackSchema.safeParse(fixture.state.pack).success,
        `${id} should contain a valid pack`,
      ).toBe(true);
    }
  });

  it("starts the interactive states at the intended point", () => {
    const opener = weeklyPackReviewFixture("opener");
    const sealed = weeklyPackReviewFixture("sealed");
    const revealed = weeklyPackReviewFixture("all-revealed");
    const confirming = weeklyPackReviewFixture("confirming");
    const datePicker = weeklyPackReviewFixture("date-picker");

    expect(
      opener.state.status === "ready"
        ? opener.state.pack
        : null,
    ).toMatchObject({
      status: "available",
      revealedCardIds: [],
    });
    expect(
      sealed.state.status === "ready"
        ? sealed.state.pack?.revealedCardIds
        : null,
    ).toEqual([]);
    expect(
      revealed.state.status === "ready"
        ? revealed.state.pack?.revealedCardIds
        : null,
    ).toEqual(["small", "mini", "proper"]);
    expect(confirming.pendingChoice).toBe("mini");
    expect(datePicker).toMatchObject({
      showDatePicker: true,
      scheduledFor: "2026-08-08",
    });
  });

  it("shows a real person and a concrete place in the chosen experience", () => {
    const fixture = weeklyPackReviewFixture("chosen");
    const pack =
      fixture.state.status === "ready" ? fixture.state.pack : null;
    const card = pack?.cards?.find(
      (candidate) => candidate.id === pack.chosenCardId,
    );

    expect(card?.companion).toMatchObject({
      name: "Mina",
      familiarity: "new",
    });
    expect(card?.place).toMatchObject({
      name: "Ceradu Ceramics Studio",
      area: "Yeoksam-dong, Gangnam-gu",
    });
    expect(JSON.stringify(card)).not.toMatch(
      /someone new|a stranger|bring someone/i,
    );
  });
});

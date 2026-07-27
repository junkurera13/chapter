import { describe, expect, it } from "vitest";

import { normalizeLabel } from "../../../lib/togetherGeneration";
import {
  batched,
  INTRODUCTION_GRAPH_READS,
  INTRODUCTION_MIN_ANCHORS,
  INTRODUCTION_READ_BATCH,
  introductionPairKey,
  introductionRecordFor,
  isLiveIntroduction,
  normalizeCity,
  normalizeMatchLabel,
  responseOf,
  sharedAnchorsBetween,
  sideFor,
  takesPartInIntroductions,
} from "../../shared/introductions";

const NOW = 1_800_000_000_000;

function node(label: string, category: string, salience: number) {
  return { label, category, salience };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "intro-1",
    user_a_id: "user-a",
    user_b_id: "user-b",
    line: "Someone else here knows the feeling of cycling around Mojiko too.",
    anchors_json: JSON.stringify([
      { label: "cycling", category: "activity" },
      { label: "Mojiko", category: "place" },
    ]),
    user_a_response: "pending",
    user_b_response: "pending",
    status: "offered",
    created_at: NOW - 1_000,
    expires_at: NOW + 1_000,
    ...overrides,
  };
}

describe("label normalisation", () => {
  // The two sides of the product must agree on what "the same thing" means,
  // and they live in module graphs that cannot import each other.
  it("matches the connected path exactly", () => {
    const cases = [
      "Mojiko",
      "  mojiko  ",
      "MOJIKO",
      "film photography",
      "Halmoni’s tiramisu",
      "ramen (Hakata)",
      "cafe-hopping",
    ];
    for (const value of cases) {
      expect(normalizeMatchLabel(value)).toBe(normalizeLabel(value));
    }
  });

  it("reads two spellings of one city as one place", () => {
    expect(normalizeCity(" Fukuoka ")).toBe(normalizeCity("fukuoka"));
    expect(normalizeCity(undefined)).toBe("");
  });
});

describe("introductionPairKey", () => {
  it("does not depend on who was scanning", () => {
    expect(introductionPairKey("b", "a")).toBe(introductionPairKey("a", "b"));
  });
});

describe("sharedAnchorsBetween", () => {
  it("keeps only what both worlds hold", () => {
    const shared = sharedAnchorsBetween(
      [
        node("cycling", "activity", 0.9),
        node("Mojiko", "place", 0.8),
        node("darkroom printing", "interest", 0.7),
      ],
      [
        node("Cycling", "activity", 0.6),
        node("mojiko", "place", 0.5),
        node("free diving", "activity", 0.9),
      ],
    );

    expect(shared.anchors.map((anchor) => anchor.label)).toEqual([
      "cycling",
      "Mojiko",
    ]);
    // Nothing one-sided survives, from either direction.
    expect(JSON.stringify(shared.anchors)).not.toContain("darkroom");
    expect(JSON.stringify(shared.anchors)).not.toContain("free diving");
  });

  it("keeps the reader's own spelling, not the other world's", () => {
    const shared = sharedAnchorsBetween(
      [node("Mojiko", "place", 0.8)],
      [node("mojiko", "place", 0.8)],
    );
    expect(shared.anchors[0].label).toBe("Mojiko");
  });

  it("ranks by what the two of them care about put together", () => {
    const shared = sharedAnchorsBetween(
      [
        node("ramen", "interest", 0.4),
        node("cycling", "activity", 0.5),
      ],
      [
        node("ramen", "interest", 0.95),
        node("cycling", "activity", 0.5),
      ],
      1,
    );
    expect(shared.anchors.map((anchor) => anchor.label)).toEqual(["ramen"]);
  });

  it("weighs the whole overlap, not only the part the sentence can hold", () => {
    const deep = sharedAnchorsBetween(
      [
        node("a", "interest", 0.9),
        node("b", "interest", 0.9),
        node("c", "interest", 0.9),
        node("d", "interest", 0.9),
      ],
      [
        node("a", "interest", 0.9),
        node("b", "interest", 0.9),
        node("c", "interest", 0.9),
        node("d", "interest", 0.9),
      ],
    );
    const shallow = sharedAnchorsBetween(
      [node("a", "interest", 0.9), node("b", "interest", 0.9)],
      [node("a", "interest", 0.9), node("b", "interest", 0.9)],
    );

    expect(deep.anchors).toHaveLength(3);
    expect(deep.weight).toBeGreaterThan(shallow.weight);
  });

  it("de-duplicates a label the reader holds twice", () => {
    const shared = sharedAnchorsBetween(
      [node("ramen", "interest", 0.9), node("Ramen", "interest", 0.8)],
      [node("ramen", "interest", 0.9)],
    );
    expect(shared.anchors).toHaveLength(1);
  });

  it("falls under the bar when only one thread matches", () => {
    const shared = sharedAnchorsBetween(
      [node("cycling", "activity", 0.9)],
      [node("cycling", "activity", 0.6), node("opera", "interest", 0.9)],
    );
    expect(shared.anchors.length).toBeLessThan(INTRODUCTION_MIN_ANCHORS);
  });
});

describe("takesPartInIntroductions", () => {
  it("takes part by default, because being in the pool discloses nothing", () => {
    expect(takesPartInIntroductions({ home_city: "Fukuoka" })).toBe(true);
    expect(
      takesPartInIntroductions({
        home_city: "Fukuoka",
        introductions_muted: false,
      }),
    ).toBe(true);
  });

  it("stops the moment someone says stop", () => {
    expect(
      takesPartInIntroductions({
        home_city: "Fukuoka",
        introductions_muted: true,
      }),
    ).toBe(false);
  });

  it("needs a city, because two people who cannot meet are not introduced", () => {
    expect(takesPartInIntroductions({})).toBe(false);
    expect(takesPartInIntroductions({ home_city: "   " })).toBe(false);
  });

  it("reads only an explicit true as muted", () => {
    // A truthy-looking leftover must never be mistaken for consent withdrawn,
    // and nothing but `true` may quietly remove someone from the pool.
    expect(
      takesPartInIntroductions({
        home_city: "Fukuoka",
        introductions_muted: undefined,
      }),
    ).toBe(true);
  });
});

describe("batched", () => {
  it("covers every item exactly once", () => {
    const items = Array.from({ length: 14 }, (_, index) => index);
    const batches = batched(items, INTRODUCTION_READ_BATCH);

    expect(batches.flat()).toEqual(items);
    expect(batches.every((batch) => batch.length <= INTRODUCTION_READ_BATCH))
      .toBe(true);
  });

  it("has nothing to do with nothing", () => {
    expect(batched([], INTRODUCTION_READ_BATCH)).toEqual([]);
  });

  it("never reads a whole scan in one breath", () => {
    expect(INTRODUCTION_READ_BATCH).toBeLessThan(INTRODUCTION_GRAPH_READS);
  });
});

describe("isLiveIntroduction", () => {
  it("holds while nobody has said no and it has not run out", () => {
    expect(isLiveIntroduction(row(), NOW)).toBe(true);
  });

  it("closes for both sides the moment either says no", () => {
    expect(isLiveIntroduction(row({ user_a_response: "no" }), NOW)).toBe(false);
    expect(isLiveIntroduction(row({ user_b_response: "no" }), NOW)).toBe(false);
  });

  it("closes when it expires, and when it is no longer offered", () => {
    expect(isLiveIntroduction(row({ expires_at: NOW - 1 }), NOW)).toBe(false);
    expect(isLiveIntroduction(row({ status: "connected" }), NOW)).toBe(false);
    expect(isLiveIntroduction(row({ status: "expired" }), NOW)).toBe(false);
  });
});

describe("sideFor and responseOf", () => {
  it("places each person on their own side", () => {
    expect(sideFor(row(), "user-a")).toBe("a");
    expect(sideFor(row(), "user-b")).toBe("b");
    expect(sideFor(row(), "someone-else")).toBeUndefined();
  });

  it("treats anything unrecognised as unanswered", () => {
    expect(responseOf(row({ user_a_response: "maybe" }), "a")).toBe("pending");
    expect(responseOf(row({ user_a_response: undefined }), "a")).toBe("pending");
  });
});

describe("introductionRecordFor", () => {
  it("says nothing about the other person", () => {
    const record = introductionRecordFor(row(), "user-a", NOW);
    const serialized = JSON.stringify(record);

    expect(record).toBeDefined();
    expect(serialized).not.toContain("user-b");
    expect(serialized).not.toContain("user_b");
    expect(record && "partnerName" in record).toBe(false);
  });

  it("never reveals that the other person already answered", () => {
    const theyAgreed = introductionRecordFor(
      row({ user_b_response: "yes" }),
      "user-a",
      NOW,
    );
    const nobodyAnswered = introductionRecordFor(row(), "user-a", NOW);

    // The two rows differ, and the two records must not.
    expect(theyAgreed).toEqual(nobodyAnswered);
  });

  it("reports only the reader's own answer back to them", () => {
    expect(introductionRecordFor(row(), "user-a", NOW)?.state).toBe("offered");
    expect(
      introductionRecordFor(row({ user_a_response: "yes" }), "user-a", NOW)
        ?.state,
    ).toBe("waiting");
    // The same row, read from the other side, is still waiting to be answered.
    expect(
      introductionRecordFor(row({ user_a_response: "yes" }), "user-b", NOW)
        ?.state,
    ).toBe("offered");
  });

  it("returns nothing to somebody the introduction is not about", () => {
    expect(introductionRecordFor(row(), "user-c", NOW)).toBeUndefined();
  });

  it("returns nothing once it has closed", () => {
    expect(
      introductionRecordFor(row({ expires_at: NOW - 1 }), "user-a", NOW),
    ).toBeUndefined();
    expect(
      introductionRecordFor(row({ user_b_response: "no" }), "user-a", NOW),
    ).toBeUndefined();
  });

  it("survives anchors that were never written", () => {
    expect(
      introductionRecordFor(row({ anchors_json: "not json" }), "user-a", NOW)
        ?.anchors,
    ).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import type { WeeklyPackDesign } from "./weeklyPackDesign";
import {
  WeeklyPackGenerationError,
  validateWeeklyPackSocialCopy,
} from "./weeklyPackGeneration";
import { weeklyExperienceCardSchema } from "./weeklyPackSchema";
import {
  WEEKLY_PACK_PERSON_TOKEN,
  containsAnonymousPersonLanguage,
  resolveWeeklyPersonToken,
  weeklyCompanionInitials,
  type WeeklyPackCompanion,
} from "./weeklyPackSocial";

const companion: WeeklyPackCompanion = {
  connectionId: "connection-mina",
  userId: "user-mina",
  name: "Mina Park",
  familiarity: "new",
};

const socialPack = {
  cards: [
    { id: "small", format: { company: "self" } },
    { id: "mini", format: { company: "new-person" } },
    { id: "proper", format: { company: "self" } },
  ],
} as WeeklyPackDesign;

function copy(line: string) {
  return {
    cards: [
      {
        id: "small" as const,
        title: "Listen before breakfast",
        line: "Listen to one familiar block before the city wakes up.",
        promise: "Make a three-part sound map before breakfast.",
        opening: "Give one familiar street your full attention.",
        steps: ["Walk one block and record three changing sounds."],
      },
      {
        id: "mini" as const,
        title: `Make one bowl with ${WEEKLY_PACK_PERSON_TOKEN}`,
        line,
        promise: `Shape one useful bowl with ${WEEKLY_PACK_PERSON_TOKEN}.`,
        opening: "Let the clay carry the first conversation.",
        steps: ["Meet outside the studio before the class begins."],
      },
      {
        id: "proper" as const,
        title: "Follow the water outward",
        line: "Follow one continuous waterfront route beyond the city.",
        promise: "Walk the changing waterfront and collect three details.",
        opening: "Let the route become the shape of the day.",
        steps: ["Begin at the old station and follow the water outward."],
      },
    ],
  };
}

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "mini",
    scale: "mini",
    company: "new-person",
    title: "Make one bowl with Mina",
    line: "Make one pottery bowl with Mina at Ceradu Ceramics Studio.",
    promise:
      "Shape one useful bowl with Mina and leave both pieces at the studio for firing.",
    opening:
      "The clay gives the first meeting a natural rhythm without making conversation the assignment.",
    durationMinutes: { min: 120, max: 180 },
    place: {
      name: "Ceradu Ceramics Studio",
      area: "Yeoksam-dong, Gangnam-gu",
      address: "B1, 332 Nonhyeon-ro, Gangnam-gu, Seoul",
    },
    companion,
    steps: [
      "Meet outside the studio before the class begins.",
      "Take adjacent places and each make one useful bowl.",
    ],
    practical: [
      { label: "Booking", value: "Reserve two beginner seats." },
      { label: "Cost", value: "Materials and firing are included." },
      { label: "Travel", value: "Walk from the nearest station." },
    ],
    sourceUrls: ["https://example.com/ceradu"],
    image: null,
    ...overrides,
  };
}

describe("weekly social experience truth", () => {
  it("replaces the private model token with the actual person", () => {
    expect(
      resolveWeeklyPersonToken(
        `Make one bowl with ${WEEKLY_PACK_PERSON_TOKEN}.`,
        companion,
      ),
    ).toBe("Make one bowl with Mina Park.");
  });

  it("detects every generic substitute that must never reach a card", () => {
    for (const value of [
      "Meet someone new",
      "Bring a friend",
      "Go with someone you know",
      "Spend the afternoon with a stranger",
    ]) {
      expect(containsAnonymousPersonLanguage(value), value).toBe(true);
    }
    expect(containsAnonymousPersonLanguage("Make one bowl with Mina")).toBe(
      false,
    );
  });

  it("requires the composition model to point to the actual person token", () => {
    expect(() =>
      validateWeeklyPackSocialCopy({
        pack: socialPack,
        copy: copy(`Make one bowl with ${WEEKLY_PACK_PERSON_TOKEN}.`),
        companion,
      }),
    ).not.toThrow();

    expect(() =>
      validateWeeklyPackSocialCopy({
        pack: socialPack,
        copy: copy("Make one bowl beside someone new."),
        companion,
      }),
    ).toThrow(WeeklyPackGenerationError);
  });

  it("requires a real person on every social card", () => {
    expect(
      weeklyExperienceCardSchema.safeParse(
        card({ companion: undefined }),
      ).success,
    ).toBe(false);
    expect(weeklyExperienceCardSchema.safeParse(card()).success).toBe(true);
  });

  it("requires a concrete place rather than a missing venue", () => {
    expect(
      weeklyExperienceCardSchema.safeParse(card({ place: null })).success,
    ).toBe(false);
  });

  it("builds a restrained initials fallback from the real name", () => {
    expect(weeklyCompanionInitials("Mina Park")).toBe("MP");
    expect(weeklyCompanionInitials("Mina")).toBe("M");
  });
});

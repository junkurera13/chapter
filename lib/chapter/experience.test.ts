import { describe, expect, it } from "vitest";

import {
  chapterExperienceSchema,
  formatExperienceForImessage,
} from "./experience";

const andy = {
  kind: "andy" as const,
  title: "Tea above the old market",
  summary: "Walk the market once, then have one quiet pot of tea upstairs.",
  durationMinutes: 75,
  stops: [
    {
      name: "Example Tea Room",
      address: "1 Market Street, Seoul",
      activity: "Choose one unfamiliar tea and sit by the window.",
      hours: "Daily 12:00-20:00",
      price: "About ₩12,000",
    },
  ],
  gettingThere: "A five-minute walk from Example Station exit 2.",
  whyThisFits: "It has novelty without turning the afternoon into a project.",
  sources: [
    { label: "Official site", url: "https://example.com/tea" },
    { label: "Map listing", url: "https://example.org/map" },
  ],
  verifiedAt: "2026-08-10T12:00:00.000Z",
};

describe("Chapter experience contract", () => {
  it("accepts one concise, verifiable Andy", () => {
    expect(chapterExperienceSchema.parse(andy)).toEqual(andy);
  });

  it("rejects an Andy that quietly becomes a Marco", () => {
    expect(() =>
      chapterExperienceSchema.parse({ ...andy, durationMinutes: 180 }),
    ).toThrow(/45-90/);
  });

  it("renders the saved object as a compact iMessage", () => {
    expect(formatExperienceForImessage(andy)).toContain(
      "Andy · 1 hr 15 min\n\nTea above the old market",
    );
    expect(formatExperienceForImessage(andy)).not.toContain("https://");
  });
});

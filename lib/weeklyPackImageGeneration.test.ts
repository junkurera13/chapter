import { describe, expect, it, vi } from "vitest";

import type {
  WeeklyPackCardDesign,
  WeeklyPackResearchFinding,
} from "./weeklyPackDesign";
import type { WeeklyPackImageGenerationDependencies } from "./weeklyPackImageGeneration";
import {
  buildWeeklyPackImagePrompt,
  generateWeeklyPackImage,
} from "./weeklyPackImageGeneration";

const design: WeeklyPackCardDesign = {
  id: "mini",
  basis: "graph",
  format: {
    scale: "mini",
    company: "self",
    structure: "destination",
    effort: "lightly-planned",
    geography: "city",
    durationMinutes: { min: 120, max: 180 },
    energy: "quiet, tactile, and absorbed",
    timeCharacter: "soft weekend daylight",
  },
  primaryAnchorId: "private-pottery-anchor",
  anchors: [
    {
      nodeId: "private-pottery-anchor",
      label: "private childhood pottery memory",
      category: "activity",
    },
  ],
  familiarThread:
    "A private remembered connection to making something slowly by hand.",
  familiarity: {
    place: "familiar",
    activity: "new",
    person: "familiar",
    time: "familiar",
  },
  stretch: {
    dimension: "activity",
    description:
      "Shift only the activity into making one useful bowl at a shared studio table.",
  },
  experiencePromise:
    "Make one useful bowl at a calm beginner studio table during a quiet afternoon session.",
  mechanism: {
    kind: "make",
    description:
      "Work through one bounded cycle of shaping, refining, and leaving a piece to be fired.",
  },
  memoryOrConnectionPotential:
    "The bounded making rhythm creates a beginning, one tactile challenge, and an object to collect later.",
  requirements: [
    {
      kind: "availability",
      detail: "Verify a currently operating beginner session.",
    },
    { kind: "cost", detail: "Verify the complete materials cost." },
    { kind: "travel", detail: "Verify a practical return journey." },
  ],
  researchObjective:
    "Find a currently operating beginner pottery studio that supports one complete bowl-making session, and verify booking, materials, firing, travel, accessibility, and the total cost without changing the designed experience.",
  distinctFromOthers:
    "This is the only tactile making experience and the only studio setting.",
  connectionSafety: null,
};

const finding: WeeklyPackResearchFinding = {
  cardId: "mini",
  workingTitle: "Make one bowl",
  experienceAction:
    "Shape one useful bowl at a bright beginner ceramics table, refine the rim, and leave it for firing.",
  experienceType: "beginner ceramics studio",
  primaryPlace: {
    name: "Exact Secret Studio Name",
    area: "Seongsu-dong",
    address: "123 Private Venue Street",
  },
  routeOrSequence:
    "Arrive at the shared worktable, shape one bowl, refine it once, and leave it on the firing shelf.",
  logistics: {
    availability: "A weekend beginner session is currently available.",
    booking: "One seat must be reserved.",
    cost: "Materials and firing are included.",
    travel: "The studio is a short walk from the station.",
    equipment: "Aprons and tools are supplied.",
    accessibility: "Step-free access is available.",
    weather: "The studio operates indoors.",
    safety: "The session is supervised by an instructor.",
  },
  criticalFacts: [
    {
      claim: "The beginner session includes materials and firing.",
      sourceUrls: ["https://example.com/session"],
    },
    {
      claim: "The studio is currently accepting reservations.",
      sourceUrls: ["https://example.com/booking"],
    },
  ],
  researchCaveats: [],
};

const copy = {
  title: "Make one bowl",
  promise:
    "Make one useful bowl at a calm beginner table and leave it to be fired.",
};

describe("weekly pack image generation", () => {
  it("builds an environment-led prompt without private graph or exact venue data", () => {
    const prompt = buildWeeklyPackImagePrompt({ design, finding, copy });

    expect(prompt).toContain("The environment or place is the subject");
    expect(prompt).toContain("Premium Airbnb listing photography");
    expect(prompt).toContain("beginner ceramics studio");
    expect(prompt).toContain("Seongsu-dong");
    expect(prompt).not.toContain("private childhood pottery memory");
    expect(prompt).not.toContain("private-pottery-anchor");
    expect(prompt).not.toContain("Exact Secret Studio Name");
    expect(prompt).not.toContain("123 Private Venue Street");
  });

  it("generates once, persists the bytes, and records a generated image", async () => {
    const generate = vi.fn<WeeklyPackImageGenerationDependencies["generate"]>(
      async () => ({
        bytes: new Uint8Array([1, 2, 3, 4]),
        mediaType: "image/png",
      }),
    );
    const persist = vi.fn(async () => "https://cdn.example/chapter.png");

    const image = await generateWeeklyPackImage(
      {
        design,
        finding,
        copy,
        requestId: "request-1",
      },
      { generate, persist },
    );

    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0][0]).toMatchObject({
      modelId: expect.any(String),
      requestId: "request-1",
    });
    expect(persist).toHaveBeenCalledWith({
      bytes: new Uint8Array([1, 2, 3, 4]),
      mediaType: "image/png",
    });
    expect(image).toMatchObject({
      url: "https://cdn.example/chapter.png",
      kind: "generated",
    });
    expect(image.alt).toContain("Seongsu-dong");
  });
});

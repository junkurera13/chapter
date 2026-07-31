import { describe, expect, it, vi } from "vitest";

import {
  buildWeeklyPackCompositionPrompt,
  pollWeeklyPackResearch,
  retryWeeklyPackResearch,
  runWeeklyPackModelAttempts,
  validateWeeklyPackGroundedCopy,
  WeeklyPackGenerationError,
  weeklyPackModelSettingsFor,
  weeklyPackReasoningEffortFor,
  weeklyPackResearchRunsSchema,
} from "./weeklyPackGeneration";

function researchFinding(
  cardId: "small" | "mini" | "proper",
  researchCaveats: string[] = [],
) {
  return {
    cardId,
    workingTitle: `${cardId} working title`,
    experienceAction:
      cardId === "small"
        ? "Trace one compact neighbourhood loop and record a single changing detail before returning home."
        : cardId === "mini"
          ? "Shape one clay vessel at a wheel, finish its surface, and leave it for firing."
          : "Follow one continuous ridge route, make three terrain-led navigation choices, and descend by the verified exit.",
    experienceType: `${cardId} experience`,
    primaryPlace: {
      name: `${cardId} verified place`,
      area: "Seoul",
      address: `${cardId} Synthetic-ro, Seoul`,
    },
    routeOrSequence:
      "Arrive at the verified entrance, complete the action, and return by the documented route.",
    logistics: {
      availability: "Verified for the complete validity window.",
      booking: "No advance booking is required.",
      cost: "The complete expected cost is verified.",
      travel: "The outward and return routes are verified.",
      equipment: "Only ordinary personal items are required.",
      accessibility: "The documented access conditions are stated.",
      weather: "The action has a verified weather condition.",
      safety: "The arrival and exit conditions are verified.",
    },
    travelFit: {
      originCity: "Seoul",
      destinationCity: "Seoul",
      roundTripMinutes: 60,
      requiresFlight: false,
      withinDesignedGeography: true,
    },
    criticalFacts: [
      {
        claim: "The place currently operates.",
        sourceUrls: ["https://example.com/current"],
      },
      {
        claim: "The stated route currently operates.",
        sourceUrls: ["https://example.com/route"],
      },
    ],
    researchCaveats,
  };
}

const researchPack = {
  cards: (["small", "mini", "proper"] as const).map((id) => ({
    id,
    basis: "world",
    format: {
      scale: id,
      company: "self",
      structure: id === "proper" ? "journey" : "single-action",
      effort: id === "proper" ? "deliberately-planned" : "spontaneous",
      geography: id === "proper" ? "beyond-city" : "city",
      durationMinutes: { min: 60, max: id === "proper" ? 360 : 120 },
      energy: "quiet and focused",
      timeCharacter: "during verified opening hours",
    },
    stretch: { dimension: "activity", description: "A new action." },
    experiencePromise: "Complete one clear action at one verified place.",
    mechanism: { kind: "make", description: "Make one small object." },
    requirements: [],
    researchObjective: "Prove the place and every critical dependency.",
    connectionSafety: null,
  })),
} as never;

describe("weekly pack model attempts", () => {
  it("routes reasoning effort through OpenRouter model settings", () => {
    expect(
      weeklyPackReasoningEffortFor("openai/gpt-5.6-terra"),
    ).toBe("low");
    expect(weeklyPackReasoningEffortFor("openai/gpt-5.6-luna")).toBe(
      "none",
    );
    expect(weeklyPackReasoningEffortFor("moonshotai/kimi-k2.6")).toBe(
      "none",
    );
    expect(
      weeklyPackReasoningEffortFor(
        "openai/gpt-5.6-terra",
        "none",
      ),
    ).toBe("none");
  });

  it("routes GPT-5.6 through Azure without the incompatible strict parameter filter", () => {
    expect(
      weeklyPackModelSettingsFor("openai/gpt-5.6-terra", "low"),
    ).toEqual({
      reasoning: { effort: "low" },
      provider: {
        order: ["azure"],
        allow_fallbacks: true,
        data_collection: "deny",
        require_parameters: false,
        zdr: true,
      },
    });
    expect(
      weeklyPackModelSettingsFor("moonshotai/kimi-k2.6", "none"),
    ).toEqual({
      reasoning: { effort: "none" },
      provider: {
        allow_fallbacks: true,
        data_collection: "deny",
        require_parameters: true,
        zdr: true,
      },
    });
  });

  it("lets the primary model repair its own deterministic failure before fallback", async () => {
    const attempt = vi.fn(
      async ({
        modelId,
        attempt: attemptNumber,
        correction,
      }: {
        modelId: string;
        attempt: number;
        correction: string;
      }) => {
        if (modelId === "primary" && attemptNumber === 1) {
          return {
            failure: "SELF_PERSON_STRETCH",
            correction: "Keep every solo card person-familiar.",
          };
        }
        return { value: `${modelId}:${correction}` };
      },
    );

    const result = await runWeeklyPackModelAttempts({
      modelIds: ["primary", "fallback"],
      attempt,
    });

    expect(result.value).toBe(
      "primary:Keep every solo card person-familiar.",
    );
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(attempt.mock.calls.map(([value]) => value.modelId)).toEqual([
      "primary",
      "primary",
    ]);
  });

  it("retries an empty primary result before moving to fallback", async () => {
    const attempt = vi.fn(
      async ({
        modelId,
        attempt: attemptNumber,
      }: {
        modelId: string;
        attempt: number;
        correction: string;
      }) =>
        modelId === "fallback"
          ? { value: "accepted" }
          : {
              failure: "No output generated.",
              correction: `repair-${attemptNumber}`,
            },
    );

    const result = await runWeeklyPackModelAttempts({
      modelIds: ["primary", "fallback"],
      attempt,
    });

    expect(result.value).toBe("accepted");
    expect(attempt.mock.calls.map(([value]) => value.modelId)).toEqual([
      "primary",
      "primary",
      "fallback",
    ]);
  });
});

describe("weekly pack real-world grounding", () => {
  it("tells composition not to invent artificial tasks", () => {
    const prompt = buildWeeklyPackCompositionPrompt({
      pack: researchPack,
      research: [],
    });

    expect(prompt).toContain("Do not add arbitrary quotas");
    expect(prompt).toContain("Avoid the words exactly");
  });

  it("does not let vague design prose replace the researched place", () => {
    expect(() =>
      validateWeeklyPackGroundedCopy({
        research: [
          {
            cardId: "small",
            finding: {
              primaryPlace: { name: "Mapo Art Center" },
            },
          },
        ] as never,
        copy: {
          cards: [
            {
              id: "small",
              title: "Project outside",
              line: "Learn outdoor projection at a small riverside screening site.",
              promise: "Learn the setup in one afternoon.",
              opening: "Start with the projector.",
              steps: ["Set up the screen."],
            },
          ],
        },
      }),
    ).toThrow(WeeklyPackGenerationError);
  });

  it("reads legacy research run records as first attempts", () => {
    expect(
      weeklyPackResearchRunsSchema.parse([
        { cardId: "small", runId: "run-small" },
        { cardId: "mini", runId: "run-mini" },
        { cardId: "proper", runId: "run-proper" },
      ]),
    ).toEqual([
      { cardId: "small", runId: "run-small", attempt: 1 },
      { cardId: "mini", runId: "run-mini", attempt: 1 },
      { cardId: "proper", runId: "run-proper", attempt: 1 },
    ]);
  });

  it("returns only the cards that fail the post-research audit", async () => {
    const runs = weeklyPackResearchRunsSchema.parse([
      { cardId: "small", runId: "run-small" },
      { cardId: "mini", runId: "run-mini" },
      { cardId: "proper", runId: "run-proper" },
    ]);
    const result = await pollWeeklyPackResearch(
      { pack: researchPack, runs, homeCity: "Seoul" },
      async (runId) => {
        const cardId = runId.replace("run-", "") as
          | "small"
          | "mini"
          | "proper";
        return {
          status: "completed" as const,
          content: researchFinding(
            cardId,
            cardId === "mini" ? ["A critical booking remains unproved."] : [],
          ),
          citations: [],
        };
      },
    );

    expect(result.status).toBe("retry");
    if (result.status !== "retry") throw new Error("expected retry");
    expect(result.failedCardIds).toEqual(["mini"]);
    expect(result.feedback).toContain("RESEARCH_UNPROVEN");
    expect(result.feedbackByCard).toEqual({
      mini: expect.stringContaining("RESEARCH_UNPROVEN"),
    });
  });

  it("polls one pack's research runs serially", async () => {
    const runs = weeklyPackResearchRunsSchema.parse([
      { cardId: "small", runId: "run-small" },
      { cardId: "mini", runId: "run-mini" },
      { cardId: "proper", runId: "run-proper" },
    ]);
    let activeRequests = 0;
    let peakActiveRequests = 0;
    const fetchResearch = vi.fn(async () => {
      activeRequests += 1;
      peakActiveRequests = Math.max(peakActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeRequests -= 1;
      return { status: "pending" as const };
    });

    await expect(
      pollWeeklyPackResearch(
        { pack: researchPack, runs, homeCity: "Seoul" },
        fetchResearch,
      ),
    ).resolves.toEqual({ status: "pending" });

    expect(fetchResearch).toHaveBeenCalledTimes(3);
    expect(peakActiveRequests).toBe(1);
  });

  it("sends each failed card only its own audit feedback", async () => {
    const runs = weeklyPackResearchRunsSchema.parse([
      { cardId: "small", runId: "run-small" },
      { cardId: "mini", runId: "run-mini" },
      { cardId: "proper", runId: "run-proper" },
    ]);
    const startResearch = vi.fn(
      async (args: { input: string; metadata?: Record<string, string> }) => ({
        runId: `retry-${args.metadata?.card}`,
      }),
    );

    await retryWeeklyPackResearch(
      {
        pack: researchPack,
        runs,
        homeCity: "Seoul",
        weekKey: "2026-08-01",
        failedCardIds: ["small", "proper"],
        feedback: "small failed\nproper failed",
        feedbackByCard: {
          small: "small-only failure",
          proper: "proper-only failure",
        },
      },
      startResearch,
    );

    const smallPrompt = startResearch.mock.calls.find(
      ([args]) => args.metadata?.card === "small",
    )?.[0].input;
    const properPrompt = startResearch.mock.calls.find(
      ([args]) => args.metadata?.card === "proper",
    )?.[0].input;
    expect(smallPrompt).toContain("small-only failure");
    expect(smallPrompt).not.toContain("proper-only failure");
    expect(properPrompt).toContain("proper-only failure");
    expect(properPrompt).not.toContain("small-only failure");
  });

  it("restarts only failed cards and keeps accepted research run ids", async () => {
    const runs = weeklyPackResearchRunsSchema.parse([
      { cardId: "small", runId: "run-small" },
      { cardId: "mini", runId: "run-mini" },
      { cardId: "proper", runId: "run-proper" },
    ]);
    const startResearch = vi.fn(
      async (args: {
        input: string;
        outputSchema: Record<string, unknown>;
        processor?: string;
        metadata?: Record<string, string>;
      }) => ({ runId: `run-${args.metadata?.card}-retry` }),
    );

    const nextRuns = await retryWeeklyPackResearch(
      {
        pack: researchPack,
        runs,
        homeCity: "Seoul",
        weekKey: "2026-08-01",
        failedCardIds: ["mini"],
        feedback: "mini RESEARCH_UNPROVEN: booking was not proved",
      },
      startResearch,
    );

    expect(startResearch).toHaveBeenCalledTimes(1);
    expect(startResearch.mock.calls[0][0].metadata).toEqual(
      expect.objectContaining({ card: "mini", attempt: "2" }),
    );
    expect(nextRuns).toEqual([
      runs[0],
      { cardId: "mini", runId: "run-mini-retry", attempt: 2 },
      runs[2],
    ]);
  });

  it("does not start partial paid retries after one failed card is exhausted", async () => {
    const runs = weeklyPackResearchRunsSchema.parse([
      { cardId: "small", runId: "run-small", attempt: 1 },
      { cardId: "mini", runId: "run-mini", attempt: 2 },
      { cardId: "proper", runId: "run-proper", attempt: 1 },
    ]);
    const startResearch = vi.fn(async () => ({ runId: "unused" }));

    await expect(
      retryWeeklyPackResearch(
        {
          pack: researchPack,
          runs,
          homeCity: "Seoul",
          weekKey: "2026-08-01",
          failedCardIds: ["small", "mini"],
          feedback: "Both cards failed.",
        },
        startResearch,
      ),
    ).rejects.toThrow("mini failed after 2 attempts");
    expect(startResearch).not.toHaveBeenCalled();
  });
});

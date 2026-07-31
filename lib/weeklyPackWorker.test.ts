import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  WeeklyPackGenerationSource,
  WeeklyPackPreparation,
} from "./base44Functions";
import {
  weeklyPackDesignArtifactSchema,
  type WeeklyPackDesignArtifact,
} from "./weeklyPackDesign";
import { weeklyPackResearchRunsSchema } from "./weeklyPackGeneration";
import {
  runWeeklyPackCycle,
  weeklyPackContextFrom,
  type WeeklyPackWorkerDependencies,
} from "./weeklyPackWorker";

const WEDNESDAY_IN_SEOUL = Date.parse("2026-07-29T03:00:00.000Z");

function preparation(
  overrides: Partial<WeeklyPackPreparation> = {},
): WeeklyPackPreparation {
  return {
    id: "pack-1",
    ownerUserId: "owner-1",
    weekKey: "2026-08-01",
    timezone: "Asia/Seoul",
    releaseAt: Date.parse("2026-08-01T00:00:00.000Z"),
    expiresAt: Date.parse("2026-08-22T00:00:00.000Z"),
    status: "preparing",
    attemptCount: 1,
    updatedAt: Date.parse("2026-07-29T02:00:00.000Z"),
    ...overrides,
  };
}

function source(): WeeklyPackGenerationSource {
  return {
    ownerUserId: "owner-1",
    homeCity: "Seoul",
    timezone: "Asia/Seoul",
    availableCompanies: ["self", "new-person"],
    socialCandidate: {
      company: "new-person",
      companion: {
        connectionId: "connection-mina",
        userId: "user-mina",
        name: "Mina",
        familiarity: "new",
      },
      sharedAnchors: [
        {
          nodeId: "shared-pottery",
          label: "pottery",
          category: "activity",
        },
        {
          nodeId: "shared-seoul",
          label: "Seoul",
          category: "place",
        },
      ],
    },
    graph: {
      memoryCount: 1,
      onboardingStep: "memory_ready",
      nodes: [
        {
          id: "owner-pottery",
          sourceType: "memory",
          category: "activity",
          subtype: "craft",
          kind: "activity",
          label: "pottery",
          description: "A real activity from the owner's graph.",
          certainty: "fact",
          confidence: 0.9,
          salience: 0.8,
          evidence: "Synthetic test evidence.",
          createdAt: 0,
        },
      ],
      edges: [],
    },
  };
}

function dependencies() {
  return {
    listPreparations: vi.fn<
      WeeklyPackWorkerDependencies["listPreparations"]
    >(async () => ({ preparations: [] })),
    pollResearch: vi.fn<WeeklyPackWorkerDependencies["pollResearch"]>(
      async () => ({ status: "pending" as const }),
    ),
    retryResearch: vi.fn<WeeklyPackWorkerDependencies["retryResearch"]>(
      async ({ runs }) => runs,
    ),
    composeCards: vi.fn(async () => []),
    completePreparation: vi.fn(async () => ({
      pack: {} as never,
    })),
    failPreparation: vi.fn(async ({ packId }: { packId: string }) => ({
      preparation: preparation({ id: packId, status: "failed" }),
    })),
    listCandidates: vi.fn(async () => ({
      candidates: [
        {
          ownerUserId: "owner-1",
          homeCity: "Seoul",
          timezone: "Asia/Seoul",
        },
      ],
    })),
    fetchSource: vi.fn(async () => source()),
    claimPreparation: vi.fn<
      WeeklyPackWorkerDependencies["claimPreparation"]
    >(async () => ({
      claimed: true,
      preparation: preparation(),
    })),
    designPack: vi.fn<WeeklyPackWorkerDependencies["designPack"]>(
      async () =>
        ({
          pack: { cards: [] },
          review: {},
          revisionReviews: [],
        }) as never,
    ),
    redesignPack: vi.fn<WeeklyPackWorkerDependencies["redesignPack"]>(
      async () => ({ pack: { cards: [] } }) as never,
    ),
    startResearch: vi.fn<WeeklyPackWorkerDependencies["startResearch"]>(
      async () => [
        { cardId: "small" as const, runId: "run-small", attempt: 1 },
        { cardId: "mini" as const, runId: "run-mini", attempt: 1 },
        { cardId: "proper" as const, runId: "run-proper", attempt: 1 },
      ],
    ),
    startResearchForCards: vi.fn<
      WeeklyPackWorkerDependencies["startResearchForCards"]
    >(async () => []),
    setResearch: vi.fn(async () => ({
      preparation: preparation(),
    })),
    newRequestId: vi.fn(() => "request-1"),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("weekly pack worker", () => {
  it("can draw a solo week even when one real person is eligible", () => {
    const context = weeklyPackContextFrom(source(), "request-solo");
    expect(context.availableCompanies).toEqual(["self"]);
    expect(context.socialMatch).toBeUndefined();
    expect(
      context.shapeContracts?.every((contract) => contract.company === "self"),
    ).toBe(true);
  });

  it("does not claim or spend outside the local preparation window", async () => {
    const current = dependencies();
    const summary = await runWeeklyPackCycle(
      {
        now: Date.parse("2026-07-27T03:00:00.000Z"),
        maxNewPacks: 2,
      },
      current as unknown as WeeklyPackWorkerDependencies,
    );

    expect(summary.candidatesExamined).toBe(1);
    expect(summary.candidatesEligible).toBe(0);
    expect(current.fetchSource).not.toHaveBeenCalled();
    expect(current.designPack).not.toHaveBeenCalled();
    expect(current.startResearch).not.toHaveBeenCalled();
  });

  it("claims before generation and starts exactly three independent runs", async () => {
    const current = dependencies();
    const summary = await runWeeklyPackCycle(
      { now: WEDNESDAY_IN_SEOUL, maxNewPacks: 1 },
      current as unknown as WeeklyPackWorkerDependencies,
    );

    expect(summary.packsStarted).toBe(1);
    expect(current.claimPreparation).toHaveBeenCalledTimes(1);
    expect(
      current.claimPreparation.mock.invocationCallOrder[0],
    ).toBeLessThan(current.designPack.mock.invocationCallOrder[0]);
    expect(current.startResearch).toHaveBeenCalledTimes(1);
    expect(current.setResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        packId: "pack-1",
        researchRunIdsJson: expect.stringContaining("run-proper"),
      }),
    );
    expect(
      current.designPack.mock.calls[0][0].source.context.availableCompanies,
    ).toEqual(["self", "new-person"]);
    expect(
      current.designPack.mock.calls[0][0].source.context.socialMatch,
    ).toEqual({
      company: "new-person",
      sharedAnchors: source().socialCandidate?.sharedAnchors,
    });
    expect(
      JSON.stringify(current.designPack.mock.calls[0][0]),
    ).not.toContain("Mina");
    expect(current.setResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        designJson: expect.stringContaining('"name":"Mina"'),
      }),
    );
    expect(
      current.startResearch.mock.calls[0][0].context,
    ).toBe(current.designPack.mock.calls[0][0].source.context);
    expect(
      current.designPack.mock.calls[0][0].source.context.shapeContracts,
    ).toHaveLength(3);
  });

  it("asks Base44 for retries only on Friday", async () => {
    const current = dependencies();
    current.claimPreparation.mockResolvedValue({
      claimed: false,
      preparation: null,
    });

    const summary = await runWeeklyPackCycle(
      {
        now: Date.parse("2026-07-31T03:00:00.000Z"),
        maxNewPacks: 1,
      },
      current as unknown as WeeklyPackWorkerDependencies,
    );

    expect(summary.claimsSkipped).toBe(1);
    expect(current.claimPreparation).toHaveBeenCalledWith(
      expect.objectContaining({ retryOnly: true }),
    );
    expect(current.designPack).not.toHaveBeenCalled();
    expect(current.startResearch).not.toHaveBeenCalled();
  });

  it("finishes completed research before looking for new work", async () => {
    const current = dependencies();
    const stored = preparation({
      design: { stored: "artifact" },
      researchRuns: { stored: "runs" },
    });
    current.listPreparations.mockResolvedValue({ preparations: [stored] });
    const artifact = {
      pack: { cards: [] },
      review: {},
      revisionReviews: [],
      homeCity: "Seoul",
    } as unknown as WeeklyPackDesignArtifact;
    const runs = [
      { cardId: "small" as const, runId: "run-small", attempt: 1 },
      { cardId: "mini" as const, runId: "run-mini", attempt: 1 },
      { cardId: "proper" as const, runId: "run-proper", attempt: 1 },
    ];
    vi.spyOn(weeklyPackDesignArtifactSchema, "parse").mockReturnValue(artifact);
    vi.spyOn(weeklyPackResearchRunsSchema, "parse").mockReturnValue(runs);
    current.pollResearch.mockResolvedValue({
      status: "completed",
      results: [],
      audit: {
        valid: true,
        errors: [],
        warnings: [],
        collidingCardIds: [],
      },
    });

    const summary = await runWeeklyPackCycle(
      { now: WEDNESDAY_IN_SEOUL, maxNewPacks: 0 },
      current as unknown as WeeklyPackWorkerDependencies,
    );

    expect(summary.packsReady).toBe(1);
    expect(current.pollResearch).toHaveBeenCalledWith({
      pack: artifact.pack,
      runs,
      homeCity: "Seoul",
      requestId: undefined,
    });
    expect(current.completePreparation).toHaveBeenCalledTimes(1);
    expect(current.listCandidates).not.toHaveBeenCalled();
  });

  it("keeps strong research runs and persists a targeted card retry", async () => {
    const current = dependencies();
    const stored = preparation({
      design: { stored: "artifact" },
      researchRuns: { stored: "runs" },
    });
    current.listPreparations.mockResolvedValue({ preparations: [stored] });
    const artifact = {
      pack: { cards: [] },
      homeCity: "Bangbae-dong, Seoul, South Korea",
      revisionReviews: [],
    } as unknown as WeeklyPackDesignArtifact;
    const runs = [
      { cardId: "small" as const, runId: "run-small", attempt: 1 },
      { cardId: "mini" as const, runId: "run-mini", attempt: 1 },
      { cardId: "proper" as const, runId: "run-proper", attempt: 1 },
    ];
    const retriedRuns = [
      runs[0],
      { cardId: "mini" as const, runId: "run-mini-retry", attempt: 2 },
      runs[2],
    ];
    vi.spyOn(weeklyPackDesignArtifactSchema, "parse").mockReturnValue(artifact);
    vi.spyOn(weeklyPackResearchRunsSchema, "parse").mockReturnValue(runs);
    current.pollResearch.mockResolvedValue({
      status: "retry",
      failedCardIds: ["mini"],
      feedback: "mini RESEARCH_UNPROVEN: booking was not proved",
    });
    current.retryResearch.mockResolvedValue(retriedRuns);

    const summary = await runWeeklyPackCycle(
      { now: WEDNESDAY_IN_SEOUL, maxNewPacks: 0 },
      current as unknown as WeeklyPackWorkerDependencies,
    );

    expect(summary.researchPending).toBe(1);
    expect(summary.preparationFailures).toBe(0);
    expect(current.retryResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        runs,
        failedCardIds: ["mini"],
        homeCity: "Bangbae-dong, Seoul, South Korea",
      }),
    );
    expect(current.setResearch).toHaveBeenCalledWith({
      packId: "pack-1",
      designJson: JSON.stringify(artifact),
      researchRunIdsJson: JSON.stringify(retriedRuns),
    });
    expect(current.composeCards).not.toHaveBeenCalled();
    expect(retriedRuns[0]).toBe(runs[0]);
    expect(retriedRuns[2]).toBe(runs[2]);
  });

  it("abandons an unresearchable direction after its targeted retry is exhausted", async () => {
    const current = dependencies();
    const stored = preparation({
      design: { stored: "artifact" },
      researchRuns: { stored: "runs" },
      generationRequestId: "request-existing",
    });
    current.listPreparations.mockResolvedValue({ preparations: [stored] });
    const failedCard = {
      id: "proper",
      experiencePromise: "Join a supervised habitat-restoration shift.",
      mechanism: { kind: "help", description: "Restore a habitat." },
    };
    const artifact = {
      pack: { cards: [failedCard] },
      homeCity: "Seoul",
      revisionReviews: [],
      researchDesignAttempt: 1,
    } as unknown as WeeklyPackDesignArtifact;
    const runs = [
      { cardId: "small" as const, runId: "run-small", attempt: 1 },
      { cardId: "mini" as const, runId: "run-mini", attempt: 1 },
      { cardId: "proper" as const, runId: "run-proper-retry", attempt: 2 },
    ];
    const redesignedPack = { cards: [] };
    const redesignedRuns = [
      { cardId: "proper" as const, runId: "next-proper", attempt: 1 },
    ];
    vi.spyOn(weeklyPackDesignArtifactSchema, "parse").mockReturnValue(artifact);
    vi.spyOn(weeklyPackResearchRunsSchema, "parse").mockReturnValue(runs);
    current.pollResearch.mockResolvedValue({
      status: "retry",
      failedCardIds: ["proper"],
      feedback: "proper RESEARCH_UNPROVEN: no supervised shift exists",
    });
    current.redesignPack.mockResolvedValue({ pack: redesignedPack } as never);
    current.startResearchForCards.mockResolvedValue(redesignedRuns);

    const summary = await runWeeklyPackCycle(
      { now: WEDNESDAY_IN_SEOUL, maxNewPacks: 0 },
      current as unknown as WeeklyPackWorkerDependencies,
    );

    expect(summary.researchPending).toBe(1);
    expect(summary.preparationFailures).toBe(0);
    expect(current.retryResearch).not.toHaveBeenCalled();
    expect(current.fetchSource).toHaveBeenCalledWith("owner-1");
    expect(current.redesignPack).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "request-existing",
        failedCardIds: ["proper"],
        abandonedDirections: expect.arrayContaining([
          expect.objectContaining({
            cardId: "proper",
            experiencePromise: failedCard.experiencePromise,
          }),
        ]),
      }),
    );
    expect(current.setResearch).toHaveBeenCalledWith({
      packId: "pack-1",
      designJson: JSON.stringify({
        pack: redesignedPack,
        researchDesignAttempt: 2,
        researchDesignAttempts: { small: 1, mini: 1, proper: 2 },
        abandonedResearchDirections: [
          {
            cardId: "proper",
            experiencePromise: failedCard.experiencePromise,
            mechanismKind: failedCard.mechanism.kind,
            mechanismDescription: failedCard.mechanism.description,
            failure: "proper RESEARCH_UNPROVEN: no supervised shift exists",
          },
        ],
        homeCity: "Seoul",
        companion: undefined,
      }),
      researchRunIdsJson: JSON.stringify([
        runs[0],
        runs[1],
        redesignedRuns[0],
      ]),
    });
  });

  it("reclaims a preparation immediately when the original fails on Friday", async () => {
    const current = dependencies();
    current.listPreparations.mockResolvedValue({
      preparations: [
        preparation({
          design: { stored: "artifact" },
          researchRuns: { stored: "runs" },
        }),
      ],
    });
    vi.spyOn(weeklyPackDesignArtifactSchema, "parse").mockReturnValue({
      pack: { cards: [] },
      homeCity: "Seoul",
      revisionReviews: [],
      researchDesignAttempt: 3,
    } as unknown as WeeklyPackDesignArtifact);
    vi.spyOn(weeklyPackResearchRunsSchema, "parse").mockReturnValue([
      { cardId: "small", runId: "run-small", attempt: 2 },
      { cardId: "mini", runId: "run-mini", attempt: 1 },
      { cardId: "proper", runId: "run-proper", attempt: 1 },
    ]);
    current.pollResearch.mockResolvedValue({
      status: "retry",
      failedCardIds: ["small"],
      feedback: "small remained unproved",
    });
    current.retryResearch.mockRejectedValue(
      new Error("research attempt limit reached"),
    );

    const summary = await runWeeklyPackCycle(
      {
        now: Date.parse("2026-07-31T03:00:00.000Z"),
        maxNewPacks: 1,
      },
      current as unknown as WeeklyPackWorkerDependencies,
    );

    expect(summary.preparationFailures).toBe(1);
    expect(summary.packsStarted).toBe(1);
    expect(current.failPreparation).toHaveBeenCalledTimes(1);
    expect(current.claimPreparation).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: "owner-1",
        retryOnly: true,
      }),
    );
    expect(current.designPack).toHaveBeenCalledTimes(1);
    expect(current.startResearch).toHaveBeenCalledTimes(1);
  });
});

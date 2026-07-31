import { describe, expect, it } from "vitest";

import {
  auditWeeklyPackDesign,
  auditWeeklyPackResearch,
  buildWeeklyPackDesignPrompt,
  buildWeeklyPackGraphDigest,
  buildWeeklyPackResearchPrompt,
  buildWeeklyPackReviewPrompt,
  buildWeeklyPackRevisionPrompt,
  canonicalizeWeeklyPackAnchors,
  chooseWeeklyPackShapeContracts,
  describeWeeklyPackReviewFailure,
  enforceWeeklyPackReviewThresholds,
  summarizeWeeklyPackReview,
  weeklyPackDesignSchema,
  weeklyPackResearchFindingSchema,
  weeklyPackReviewSchema,
  type WeeklyPackCardDesign,
  type WeeklyPackDesign,
} from "./weeklyPackDesign";
import { seededChapterRandom } from "./chapterEquation";
import {
  WEEKLY_PACK_FIXTURES,
  weeklyPackFixtureById,
} from "../scripts/weekly-pack-fixtures";

function fixture(id = "sparse") {
  const value = weeklyPackFixtureById(id);
  if (!value) throw new Error(`Missing fixture ${id}`);
  return value;
}

function requirements(seed: string): WeeklyPackCardDesign["requirements"] {
  return [
    {
      kind: "availability",
      detail: `Prove the current operating window for ${seed}.`,
    },
    {
      kind: "cost",
      detail: `Prove the complete expected cost for ${seed}.`,
    },
    {
      kind: "travel",
      detail: `Prove a practical return journey for ${seed}.`,
    },
  ];
}

function card(args: {
  id: "small" | "mini" | "proper";
  basis?: "world" | "graph" | "social";
  anchorId: string;
  anchorLabel: string;
  anchorCategory: string;
  mechanism: "observe" | "make" | "explore";
}): WeeklyPackCardDesign {
  const basis = args.basis ?? "graph";
  const formats = {
    small: {
      scale: "small" as const,
      company: "self" as const,
      structure: "single-action" as const,
      effort: "spontaneous" as const,
      geography: "neighbourhood" as const,
      durationMinutes: { min: 40, max: 70 },
      energy: "quiet and attentive",
      timeCharacter: "flexible daylight",
    },
    mini: {
      scale: "mini" as const,
      company: "self" as const,
      structure: "destination" as const,
      effort: "lightly-planned" as const,
      geography: "city" as const,
      durationMinutes: { min: 140, max: 210 },
      energy: "hands-on and absorbed",
      timeCharacter: "one open afternoon",
    },
    proper: {
      scale: "proper" as const,
      company: "self" as const,
      structure: "journey" as const,
      effort: "deliberately-planned" as const,
      geography: "beyond-city" as const,
      durationMinutes: { min: 360, max: 540 },
      energy: "steady with room for discovery",
      timeCharacter: "a full clear day",
    },
  };
  const content = {
    small: {
      thread:
        "The remembered habit of noticing the city while it is still quiet.",
      stretch:
        "Shift only the activity into a compact act of recording three changing sounds.",
      promise:
        "Listen along one familiar block at first light and make a three-part sound map before breakfast.",
      potential:
        "A fixed three-sound constraint creates a small beginning, discovery, and object to keep.",
      research:
        "Find and verify a safe, legally accessible familiar-scale street segment where early sound changes are distinct; prove current access, practical transport, complete cost, sunrise timing, and any recording restrictions without turning the idea into a venue recommendation.",
      distinct:
        "This is the shortest card and uses close observation rather than making an object or taking a journey.",
    },
    mini: {
      thread:
        "The familiar riverside setting as a place for unhurried attention.",
      stretch:
        "Shift only the activity into making a simple wind-driven paper object.",
      promise:
        "Build one simple wind marker, test it beside familiar moving water, and adjust it once from what the air reveals.",
      potential:
        "Making, testing, and one revision gives the afternoon a natural arc and leaves behind a tangible trace.",
      research:
        "Verify an attainable paper-making or materials source and a suitable waterside testing area that together support this exact build-test-adjust action; prove current availability, total cost, city travel, wind practicality, access, equipment, and safe use while preserving one familiar place dimension.",
      distinct:
        "This is a hands-on city afternoon with a made object, unlike the listening ritual and the beyond-city journey.",
    },
    proper: {
      thread:
        "The factual memory of walking with enough time for the route itself to matter.",
      stretch:
        "Shift only the place into an unfamiliar landscape reached by a coherent outward journey.",
      promise:
        "Follow one continuous ridge-to-village route, collect three signs of the changing terrain, and use them to choose the final turn.",
      potential:
        "The outward travel, changing terrain, and one consequential choice form a restrained full-day story.",
      research:
        "Prove one coherent and currently open ridge-to-village route beyond the city whose journey supports the three-sign navigation constraint; verify trail status, daylight, return transport, total cost, weather, equipment, safety, access points, and bailout options rather than substituting a famous destination.",
      distinct:
        "This is the only full-day journey and the only place stretch; its mechanism is movement through changing terrain.",
    },
  }[args.id];
  const stretchDimension = args.id === "proper" ? "place" : "activity";
  return {
    id: args.id,
    basis,
    format: formats[args.id],
    primaryAnchorId: basis === "world" ? null : args.anchorId,
    anchors:
      basis === "world"
        ? []
        : [
            {
              nodeId: args.anchorId,
              label: args.anchorLabel,
              category: args.anchorCategory,
            },
          ],
    familiarThread: content.thread,
    familiarity: {
      place: stretchDimension === "place" ? "new" : "familiar",
      activity: stretchDimension === "activity" ? "new" : "familiar",
      person: "familiar",
      interest: "familiar",
    },
    stretch: {
      dimension: stretchDimension,
      description: content.stretch,
    },
    supportingContext: null,
    experiencePromise: content.promise,
    mechanism: {
      kind: args.mechanism,
      description: content.promise,
    },
    memoryOrConnectionPotential: content.potential,
    requirements: requirements(args.id),
    researchObjective: content.research,
    distinctFromOthers: content.distinct,
    connectionSafety: null,
  };
}

function validPack(): WeeklyPackDesign {
  return weeklyPackDesignSchema.parse({
    packThesis:
      "Three different ways to turn quiet attention into action, rising from one compact ritual to a full journey.",
    cards: [
      card({
        id: "small",
        anchorId: "sparse-calm",
        anchorLabel: "unhurried calm",
        anchorCategory: "feeling",
        mechanism: "observe",
      }),
      card({
        id: "mini",
        basis: "world",
        anchorId: "sparse-river",
        anchorLabel: "riverside",
        anchorCategory: "place",
        mechanism: "make",
      }),
      card({
        id: "proper",
        basis: "world",
        anchorId: "sparse-walk",
        anchorLabel: "walking",
        anchorCategory: "activity",
        mechanism: "explore",
      }),
    ],
  });
}

function audit(pack = validPack(), fixtureId = "sparse") {
  const current = fixture(fixtureId);
  return auditWeeklyPackDesign({
    pack,
    graph: current.graph,
    context: current.context,
  });
}

describe("weekly pack design lab", () => {
  it("ships all seven pressure-test fixtures without real memory evidence", () => {
    expect(WEEKLY_PACK_FIXTURES).toHaveLength(7);
    for (const current of WEEKLY_PACK_FIXTURES) {
      expect(
        current.graph.nodes.every((node) =>
          node.evidence.includes("Synthetic"),
        ),
      ).toBe(true);
    }
  });

  it("keeps useful evidence strength but excludes raw evidence from the model digest", () => {
    const current = fixture();
    const digest = buildWeeklyPackGraphDigest(current.graph);
    expect(digest.nodes[0]).toHaveProperty("confidence");
    expect(digest.edges[0]).toHaveProperty("strength");
    expect(JSON.stringify(digest)).not.toContain("Synthetic fixture evidence");
    expect(buildWeeklyPackDesignPrompt(current)).not.toContain(
      "Synthetic fixture evidence",
    );
  });

  it("forbids a person stretch when the pack has no social candidate", () => {
    const prompt = buildWeeklyPackDesignPrompt(fixture());
    expect(prompt).toContain(
      "A self-company card never uses person.",
    );
    expect(prompt).toContain("no card may declare `person` as its stretch");
  });

  it("draws only empty categories and keeps solo as the no-match reality", () => {
    const current = fixture();
    const contracts = chooseWeeklyPackShapeContracts({
      graph: current.graph,
      random: seededChapterRandom("shape-contract"),
    });
    expect(contracts).toHaveLength(3);
    expect(contracts.filter((contract) => contract.basis === "world")).toHaveLength(
      2,
    );
    expect(contracts.every((contract) => contract.company === "self")).toBe(
      true,
    );
    expect(JSON.stringify(contracts)).not.toContain("riverside");
    expect(JSON.stringify(contracts)).not.toContain("Seoul");
  });

  it("keeps a first meeting off the proper card and out of a third layer", () => {
    const current = fixture("eligible-stranger");
    const contracts = chooseWeeklyPackShapeContracts({
      graph: current.graph,
      socialMatch: current.context.socialMatch,
      random: () => 0.999999,
    });
    const social = contracts.find((contract) => contract.basis === "social");
    expect(social).toMatchObject({
      company: "new-person",
      twistDimension: "people",
      contextDimension: null,
    });
    expect(social?.cardId).not.toBe("proper");
  });

  it("keeps old stored time fields readable without drawing time again", () => {
    const stored = structuredClone(validPack()) as unknown as {
      cards: Array<{
        familiarity: Record<string, string>;
        supportingContext?: unknown;
      }>;
    };
    for (const candidate of stored.cards) {
      delete candidate.familiarity.interest;
      candidate.familiarity.time = "familiar";
      delete candidate.supportingContext;
    }
    const parsed = weeklyPackDesignSchema.parse(stored);
    expect(parsed.cards.every((candidate) => candidate.familiarity.interest === "familiar")).toBe(
      true,
    );
  });

  it("sends Parallel only the research-safe design cut", () => {
    const current = fixture();
    const designed = validPack().cards[0];
    const prompt = buildWeeklyPackResearchPrompt({
      card: designed,
      context: current.context,
      currentDate: "2026-07-29",
    });

    expect(prompt).toContain(designed.researchObjective);
    expect(prompt).toContain(designed.experiencePromise);
    expect(prompt).not.toContain(designed.familiarThread);
    expect(prompt).not.toContain(designed.anchors[0].label);
    expect(prompt).not.toContain(designed.primaryAnchorId);
    expect(prompt).toContain('Return originCity exactly as "Seoul"');
    expect(prompt).toContain("Flights are never allowed");
    expect(prompt).toContain(
      "primaryPlace must be one actual, currently operating named location",
    );
    expect(prompt).toContain(
      "complete round trip must take at most 90 minutes",
    );
  });

  it("accepts one small, mini, and proper card with separate mechanisms and stretches", () => {
    expect(audit()).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it("keeps two cards world-led and only one graph-led", () => {
    const pack = validPack();
    expect(pack.cards.map((candidate) => candidate.basis)).toEqual([
      "graph",
      "world",
      "world",
    ]);
    expect(pack.cards[1].anchors).toEqual([]);
    expect(pack.cards[1].primaryAnchorId).toBeNull();
    expect(buildWeeklyPackDesignPrompt(fixture())).toContain(
      "exactly two `world` cards and one `graph` card",
    );
  });

  it("rejects graph anchors on a world-led card", () => {
    const pack = structuredClone(validPack());
    pack.cards[1].primaryAnchorId = "sparse-river";
    pack.cards[1].anchors = [
      {
        nodeId: "sparse-river",
        label: "riverside",
        category: "place",
      },
    ];
    const result = audit(pack);
    expect(result.errors.map((issue) => issue.code)).toContain(
      "WORLD_CARD_HAS_ANCHORS",
    );
  });

  it("catches pack monoculture and multiple new dimensions", () => {
    const pack = structuredClone(validPack());
    pack.cards[1].mechanism.kind = pack.cards[0].mechanism.kind;
    pack.cards[1].familiarity.interest = "new";
    const result = audit(pack);
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "MECHANISM_REUSED",
        "CHAPTER_SHAPE_FAMILIARITY",
      ]),
    );
  });

  it("canonicalizes anchor labels while rejecting unknown anchor ids", () => {
    const current = fixture();
    const pack = structuredClone(validPack());
    pack.cards[0].anchors[0].label = "model invented label";
    const canonical = canonicalizeWeeklyPackAnchors(pack, current.graph);
    expect(canonical.cards[0].anchors[0].label).toBe("unhurried calm");

    canonical.cards[0].anchors[0].nodeId = "not-in-graph";
    canonical.cards[0].primaryAnchorId = "not-in-graph";
    expect(
      auditWeeklyPackDesign({
        pack: canonical,
        graph: current.graph,
        context: current.context,
      }).errors.map((issue) => issue.code),
    ).toContain("ANCHOR_UNKNOWN");
  });

  it("rejects a stranger card if the person is not the only stretch or any safety gate fails", () => {
    const current = fixture("eligible-stranger");
    const pack = structuredClone(validPack());
    const small = pack.cards[0];
    small.basis = "social";
    small.primaryAnchorId = "stranger-sketch";
    small.anchors = [
      {
        nodeId: "stranger-sketch",
        label: "observational sketching",
        category: "activity",
      },
    ];
    small.format.company = "new-person";
    small.stretch.dimension = "person";
    small.familiarity = {
      place: "familiar",
      activity: "familiar",
      person: "new",
      interest: "familiar",
    };
    small.connectionSafety = {
      publicPopulatedSetting: true,
      boundedDuration: true,
      activityCentred: true,
      clearArrivalPoint: true,
      easyExit: false,
      worthwhileWithoutConnection: true,
      noAlcoholDependency: true,
    };
    const result = auditWeeklyPackDesign({
      pack,
      graph: current.graph,
      context: current.context,
    });
    expect(result.errors.map((issue) => issue.code)).toContain(
      "NEW_PERSON_SAFETY",
    );
  });

  it("enforces the numeric quality threshold instead of trusting model verdicts", () => {
    const review = weeklyPackReviewSchema.parse({
      cardReviews: ["small", "mini", "proper"].map((cardId, index) => ({
        cardId,
        hardGateFailures: [],
        scores: {
          recognition: index === 0 ? 2 : 4,
          transformation: 4,
          experienceMechanism: 4,
          storyPotential: 4,
          actionability: 4,
          restraintAndTruth: 4,
        },
        strongestQuality: "The action creates a clear lived mechanism.",
        revisionPriority:
          "Strengthen the grounded recognition without making claims.",
        verdict: "accept",
      })),
      packScores: {
        contrast: 4,
        threadDiversity: 4,
        mechanismDiversity: 4,
        commitmentLadder: 4,
        choiceQuality: 4,
      },
      packFailures: [],
      revisionPriority: "Repair the weakest recognition score before research.",
      verdict: "accept",
    });
    const enforced = enforceWeeklyPackReviewThresholds(review);
    expect(enforced.cardReviews[0].verdict).toBe("reject");
    expect(enforced.verdict).toBe("reject");
    expect(summarizeWeeklyPackReview(enforced)).toMatchObject({
      verdict: "reject",
      rejectedCards: [
        {
          cardId: "small",
          lowScores: ["recognition 2/4"],
          total: 22,
        },
      ],
      lowPackScores: [],
    });
    expect(describeWeeklyPackReviewFailure(enforced)).toContain(
      "small: recognition 2/4",
    );
  });

  it("reviews and revises pre-research designs against phase-appropriate evidence", () => {
    const current = fixture();
    const pack = validPack();
    const reviewPrompt = buildWeeklyPackReviewPrompt({
      pack,
      graph: current.graph,
      context: current.context,
    });
    expect(reviewPrompt).toContain("This is a pre-research design review.");
    expect(reviewPrompt).toContain(
      "Missing future research is not a design-stage hard-gate failure.",
    );
    expect(reviewPrompt).toContain(
      "do not penalize contrast, choice quality, or any card for lacking unavailable social variety",
    );

    const acceptedReview = weeklyPackReviewSchema.parse({
      cardReviews: ["small", "mini", "proper"].map((cardId) => ({
        cardId,
        hardGateFailures: [],
        scores: {
          recognition: 4,
          transformation: 4,
          experienceMechanism: 4,
          storyPotential: 4,
          actionability: 4,
          restraintAndTruth: 4,
        },
        strongestQuality: "The action creates a clear lived mechanism.",
        revisionPriority:
          "Keep the research objective focused on critical facts.",
        verdict: "accept",
      })),
      packScores: {
        contrast: 4,
        threadDiversity: 4,
        mechanismDiversity: 4,
        commitmentLadder: 4,
        choiceQuality: 4,
      },
      packFailures: [],
      revisionPriority:
        "Preserve the pack's existing contrast during research.",
      verdict: "accept",
    });
    const revisionPrompt = buildWeeklyPackRevisionPrompt({
      pack,
      review: acceptedReview,
      graph: current.graph,
      context: current.context,
    });
    expect(revisionPrompt).toContain(
      "Repair actionability by making the experience, requirements, and research objective concrete",
    );
    expect(revisionPrompt).toContain("Only self company is available.");
  });

  it("detects a post-research collision without discarding unrelated findings", () => {
    const pack = validPack();
    const finding = (cardId: "small" | "mini" | "proper", place: string) =>
      weeklyPackResearchFindingSchema.parse({
        cardId,
        workingTitle: `${cardId} working title`,
        experienceAction:
          cardId === "proper"
            ? "Follow a continuous ridge route and make three terrain-led navigation choices."
            : `Complete a distinct ${cardId} action with a clear constraint and finish.`,
        experienceType: `${cardId} type`,
        primaryPlace: {
          name: place,
          area: "Jongno",
          address: "1 Synthetic-ro, Seoul",
        },
        routeOrSequence:
          "Arrive at the stated point, complete the action, and leave by the verified route.",
        logistics: {
          availability: "Verified for the stated window.",
          booking: "No advance booking is required.",
          cost: "The complete expected cost is verified.",
          travel: "A return public-transport route is verified.",
          equipment: "Only ordinary personal items are required.",
          accessibility: "The access limitations are stated plainly.",
          weather: "A weather fallback is documented.",
          safety: "The route and exit conditions are documented.",
        },
        criticalFacts: [
          {
            claim: "The place currently operates.",
            sourceUrls: ["https://example.com/current"],
          },
          {
            claim: "The stated access route currently operates.",
            sourceUrls: ["https://example.com/travel"],
          },
        ],
        researchCaveats: [],
      });
    const result = auditWeeklyPackResearch({
      pack,
      findings: [
        finding("small", "Same Workshop"),
        finding("mini", "same-workshop"),
        finding("proper", "Different Trail"),
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.collidingCardIds).toEqual(["small", "mini"]);
    expect(result.collidingCardIds).not.toContain("proper");
  });

  it("rejects generic locations and destination travel from weekly research", () => {
    const pack = validPack();
    const finding = (
      cardId: "small" | "mini" | "proper",
      place: string,
      travelFit: {
        originCity: string;
        destinationCity: string;
        roundTripMinutes: number;
        requiresFlight: boolean;
        withinDesignedGeography: boolean;
      },
    ) =>
      weeklyPackResearchFindingSchema.parse({
        cardId,
        workingTitle: `${cardId} working title`,
        experienceAction: `Complete the ${cardId} experience through one concrete action and a distinct finish.`,
        experienceType: `${cardId} type`,
        primaryPlace: {
          name: place,
          area: "Jongno",
          address: "1 Synthetic-ro, Seoul",
        },
        routeOrSequence:
          "Arrive at the verified starting point, complete the action, and return by the stated route.",
        logistics: {
          availability: "Verified for the stated window.",
          booking: "No advance booking is required.",
          cost: "The complete expected cost is verified.",
          travel: "A return public-transport route is verified.",
          equipment: "Only ordinary personal items are required.",
          accessibility: "The access limitations are stated plainly.",
          weather: "A weather fallback is documented.",
          safety: "The route and exit conditions are documented.",
        },
        travelFit,
        criticalFacts: [
          {
            claim: "The place currently operates.",
            sourceUrls: ["https://example.com/current"],
          },
          {
            claim: "The stated access route currently operates.",
            sourceUrls: ["https://example.com/travel"],
          },
        ],
        researchCaveats: [],
      });

    const result = auditWeeklyPackResearch({
      pack,
      homeCity: "Seoul",
      findings: [
        finding("small", "Swimming pool", {
          originCity: "Seoul",
          destinationCity: "Seoul",
          roundTripMinutes: 40,
          requiresFlight: false,
          withinDesignedGeography: true,
        }),
        finding("mini", "Seoul Forest", {
          originCity: "Seoul",
          destinationCity: "Seoul",
          roundTripMinutes: 80,
          requiresFlight: false,
          withinDesignedGeography: true,
        }),
        finding("proper", "Accor Arena", {
          originCity: "Seoul",
          destinationCity: "Paris",
          roundTripMinutes: 1_200,
          requiresFlight: true,
          withinDesignedGeography: false,
        }),
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "RESEARCH_PLACE_GENERIC",
        "RESEARCH_FLIGHT_REQUIRED",
        "RESEARCH_GEOGRAPHY_MISMATCH",
        "RESEARCH_TRAVEL_TOO_LONG",
      ]),
    );
  });
});

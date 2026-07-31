import "server-only";

import {
  claimWeeklyPackPreparation,
  completeWeeklyPackPreparation,
  failWeeklyPackPreparation,
  fetchWeeklyPackGenerationSource,
  listWeeklyPackCandidates,
  listWeeklyPackPreparations,
  setWeeklyPackResearch,
  type WeeklyPackCandidate,
  type WeeklyPackGenerationSource,
  type WeeklyPackPreparation,
} from "./base44Functions";
import {
  chooseWeeklyPackShapeContracts,
  weeklyPackDesignArtifactSchema,
  type WeeklyPackContext,
} from "./weeklyPackDesign";
import {
  chooseChapterCompany,
  seededChapterRandom,
  type ChapterCompany,
} from "./chapterEquation";
import {
  composeWeeklyExperienceCards,
  designWeeklyPack,
  pollWeeklyPackResearch,
  redesignWeeklyPackAfterResearchFailure,
  retryWeeklyPackResearch,
  startWeeklyPackResearch,
  startWeeklyPackResearchForCards,
  weeklyPackResearchRunsSchema,
} from "./weeklyPackGeneration";
import {
  isWeeklyPackPreparationDay,
  isWeeklyPackRetryDay,
  weeklyPackWindow,
} from "./weeklyPackSchedule";

type WorkerDependencies = {
  listPreparations: (
    limit?: number,
  ) => Promise<{ preparations: WeeklyPackPreparation[] }>;
  pollResearch: typeof pollWeeklyPackResearch;
  retryResearch: typeof retryWeeklyPackResearch;
  composeCards: typeof composeWeeklyExperienceCards;
  completePreparation: typeof completeWeeklyPackPreparation;
  failPreparation: typeof failWeeklyPackPreparation;
  listCandidates: (
    limit?: number,
  ) => Promise<{ candidates: WeeklyPackCandidate[] }>;
  fetchSource: (
    ownerUserId: string,
  ) => Promise<WeeklyPackGenerationSource>;
  claimPreparation: typeof claimWeeklyPackPreparation;
  designPack: typeof designWeeklyPack;
  redesignPack: typeof redesignWeeklyPackAfterResearchFailure;
  startResearch: typeof startWeeklyPackResearch;
  startResearchForCards: typeof startWeeklyPackResearchForCards;
  setResearch: typeof setWeeklyPackResearch;
  newRequestId: () => string;
};

const MAX_RESEARCH_DESIGN_ATTEMPTS = 3;

const productionDependencies: WorkerDependencies = {
  listPreparations: listWeeklyPackPreparations,
  pollResearch: pollWeeklyPackResearch,
  retryResearch: retryWeeklyPackResearch,
  composeCards: composeWeeklyExperienceCards,
  completePreparation: completeWeeklyPackPreparation,
  failPreparation: failWeeklyPackPreparation,
  listCandidates: listWeeklyPackCandidates,
  fetchSource: fetchWeeklyPackGenerationSource,
  claimPreparation: claimWeeklyPackPreparation,
  designPack: designWeeklyPack,
  redesignPack: redesignWeeklyPackAfterResearchFailure,
  startResearch: startWeeklyPackResearch,
  startResearchForCards: startWeeklyPackResearchForCards,
  setResearch: setWeeklyPackResearch,
  newRequestId: () => crypto.randomUUID(),
};

export type WeeklyPackWorkerSummary = {
  preparationsExamined: number;
  researchPending: number;
  packsReady: number;
  preparationFailures: number;
  candidatesExamined: number;
  candidatesEligible: number;
  sourcesUnavailable: number;
  claimsSkipped: number;
  packsStarted: number;
};

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

function errorDetail(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  return `${error.name}: ${error.message}`.replace(/\s+/g, " ").slice(0, 500);
}

export function weeklyPackContextFrom(
  source: WeeklyPackGenerationSource,
  requestId: string,
): WeeklyPackContext {
  const random = seededChapterRandom(requestId);
  const eligible: ChapterCompany[] = ["self"];
  if (
    source.socialCandidate &&
    source.availableCompanies.includes(source.socialCandidate.company)
  ) {
    eligible.push(source.socialCandidate.company);
  }
  const company = chooseChapterCompany({ eligible, random });
  const selectedSocial =
    company !== "self" && source.socialCandidate?.company === company
      ? {
          company: source.socialCandidate.company,
          sharedAnchors: source.socialCandidate.sharedAnchors,
        }
      : undefined;
  const availableCompanies = selectedSocial
    ? (["self", selectedSocial.company] as const)
    : (["self"] as const);
  return {
    homeCity: source.homeCity,
    privacyMode: "personal",
    availableCompanies,
    socialMatch: selectedSocial,
    shapeContracts: chooseWeeklyPackShapeContracts({
      graph: source.graph,
      socialMatch: selectedSocial,
      random,
    }),
    maxMechanismOccurrences: { taste: 1 },
    generationNotes: [
      "Make the three choices feel genuinely different in action, rhythm, and commitment.",
      selectedSocial
        ? "A real person is already attached to the social card. Design for that pair; never invent or substitute another person."
        : source.socialCandidate
          ? "A real matched person exists, but this week's weighted draw is solo. Keep all three cards solo."
          : "No real matched person is available. Keep all three cards solo.",
    ],
  };
}

export async function startClaimedWeeklyPack(
  args: {
    source: WeeklyPackGenerationSource;
    preparation: WeeklyPackPreparation;
    requestId: string;
    weekKey: string;
  },
  dependencies: WorkerDependencies = productionDependencies,
) {
  const context = weeklyPackContextFrom(args.source, args.requestId);
  const designed = await dependencies.designPack({
    source: {
      graph: args.source.graph,
      context,
    },
    requestId: args.requestId,
  });
  const artifact = {
    ...designed,
    homeCity: args.source.homeCity,
    companion: context.socialMatch
      ? args.source.socialCandidate?.companion
      : undefined,
  };
  const runs = await dependencies.startResearch({
    pack: artifact.pack,
    context,
    weekKey: args.weekKey,
  });
  await dependencies.setResearch({
    packId: args.preparation.id,
    designJson: JSON.stringify(artifact),
    researchRunIdsJson: JSON.stringify(runs),
  });
}

export async function advanceWeeklyPackPreparation(
  preparation: WeeklyPackPreparation,
  dependencies: WorkerDependencies = productionDependencies,
) {
  const artifact = weeklyPackDesignArtifactSchema.parse(preparation.design);
  const runs = weeklyPackResearchRunsSchema.parse(preparation.researchRuns);
  const research = await dependencies.pollResearch({
    pack: artifact.pack,
    runs,
    homeCity: artifact.homeCity,
    requestId: preparation.generationRequestId,
  });
  if (research.status === "pending") {
    return { status: "pending" as const };
  }
  if (research.status === "retry") {
    if (!artifact.homeCity) {
      throw new Error("Weekly pack retry requires a stored home city.");
    }
    const failedCardIds = new Set(research.failedCardIds);
    const exhaustedCardIds = runs
      .filter(
        (run) => failedCardIds.has(run.cardId) && run.attempt >= 2,
      )
      .map((run) => run.cardId);
    if (exhaustedCardIds.length > 0) {
      const recoveryCardIds = new Set(exhaustedCardIds);
      const legacyAttempt = artifact.researchDesignAttempt ?? 1;
      const researchDesignAttempts = artifact.researchDesignAttempts ?? {
        small: legacyAttempt,
        mini: legacyAttempt,
        proper: legacyAttempt,
      };
      const exhaustedAtLimit = exhaustedCardIds.filter(
        (cardId) =>
          researchDesignAttempts[cardId] >=
          MAX_RESEARCH_DESIGN_ATTEMPTS,
      );
      if (exhaustedAtLimit.length > 0) {
        throw new Error(
          `Research remained unproved after ${MAX_RESEARCH_DESIGN_ATTEMPTS} designs: ${exhaustedAtLimit.join(", ")}.`,
        );
      }

      const source = await dependencies.fetchSource(
        preparation.ownerUserId,
      );
      const requestId =
        preparation.generationRequestId ?? dependencies.newRequestId();
      const context = weeklyPackContextFrom(source, requestId);
      const latestAbandonedDirections = artifact.pack.cards
        .filter((card) => recoveryCardIds.has(card.id))
        .map((card) => ({
          cardId: card.id,
          experiencePromise: card.experiencePromise,
          mechanismKind: card.mechanism.kind,
          mechanismDescription: card.mechanism.description,
          failure: (research.feedbackByCard[card.id] ?? research.feedback).slice(
            0,
            500,
          ),
        }));
      const abandonedDirections = [
        ...(artifact.abandonedResearchDirections ?? []),
        ...latestAbandonedDirections,
      ]
        .slice(-9)
        .map((direction) => ({
          ...direction,
          experiencePromise: direction.experiencePromise.slice(0, 180),
          mechanismDescription: direction.mechanismDescription.slice(0, 180),
          failure: direction.failure.slice(0, 180),
        }));
      const designed = await dependencies.redesignPack({
        source: { graph: source.graph, context },
        requestId,
        previousPack: artifact.pack,
        failedCardIds: exhaustedCardIds,
        abandonedDirections,
        feedback: research.feedback,
      });
      const nextResearchDesignAttempts = {
        ...researchDesignAttempts,
      };
      for (const cardId of exhaustedCardIds) {
        nextResearchDesignAttempts[cardId] += 1;
      }
      const nextArtifact = {
        ...designed,
        researchDesignAttempt: Math.max(
          ...Object.values(nextResearchDesignAttempts),
        ),
        researchDesignAttempts: nextResearchDesignAttempts,
        abandonedResearchDirections: abandonedDirections,
        homeCity: source.homeCity,
        companion: context.socialMatch
          ? source.socialCandidate?.companion
          : undefined,
      };
      const replacementRuns = await dependencies.startResearchForCards({
        pack: nextArtifact.pack,
        context,
        weekKey: preparation.weekKey,
        cardIds: exhaustedCardIds,
      });
      const replacementByCard = new Map(
        replacementRuns.map((run) => [run.cardId, run]),
      );
      const nextRuns = runs.map(
        (run) => replacementByCard.get(run.cardId) ?? run,
      );
      await dependencies.setResearch({
        packId: preparation.id,
        designJson: JSON.stringify(nextArtifact),
        researchRunIdsJson: JSON.stringify(nextRuns),
      });
      return { status: "redesigning" as const };
    }
    const nextRuns = await dependencies.retryResearch({
      pack: artifact.pack,
      runs,
      homeCity: artifact.homeCity,
      weekKey: preparation.weekKey,
      failedCardIds: research.failedCardIds,
      feedback: research.feedback,
      feedbackByCard: research.feedbackByCard,
    });
    await dependencies.setResearch({
      packId: preparation.id,
      designJson: JSON.stringify(artifact),
      researchRunIdsJson: JSON.stringify(nextRuns),
    });
    return { status: "retrying" as const };
  }

  const cards = await dependencies.composeCards({
    pack: artifact.pack,
    research: research.results,
    requestId: preparation.generationRequestId ?? dependencies.newRequestId(),
    companion: artifact.companion,
  });
  const completed = await dependencies.completePreparation({
    packId: preparation.id,
    cardsJson: JSON.stringify(cards),
    researchJson: JSON.stringify({
      results: research.results,
      audit: research.audit,
    }),
  });
  return { status: "ready" as const, pack: completed.pack };
}

async function safelyFail(
  dependencies: WorkerDependencies,
  packId: string,
  phase: string,
  error: unknown,
) {
  console.error("[weekly-pack:worker] preparation failed", {
    packId,
    phase,
    errorName: errorName(error),
    errorDetail: errorDetail(error),
  });
  try {
    await dependencies.failPreparation({
      packId,
      error: `${phase} failed: ${errorDetail(error)}`,
    });
  } catch (persistError) {
    console.error("[weekly-pack:worker] failure state could not be saved", {
      packId,
      phase,
      errorName: errorName(persistError),
    });
  }
}

/**
 * Advances existing research before claiming new work. A run can be called
 * repeatedly or overlap with a retry without making a ready pack mutable:
 * Base44 owns every transition and refuses invalid states.
 */
export async function runWeeklyPackCycle(
  args: {
    now?: number;
    candidateLimit?: number;
    preparationLimit?: number;
    maxNewPacks?: number;
  } = {},
  dependencies: WorkerDependencies = productionDependencies,
): Promise<WeeklyPackWorkerSummary> {
  const now = args.now ?? Date.now();
  const summary: WeeklyPackWorkerSummary = {
    preparationsExamined: 0,
    researchPending: 0,
    packsReady: 0,
    preparationFailures: 0,
    candidatesExamined: 0,
    candidatesEligible: 0,
    sourcesUnavailable: 0,
    claimsSkipped: 0,
    packsStarted: 0,
  };
  const ownersAlreadyProcessed = new Set<string>();

  const { preparations } = await dependencies.listPreparations(
    args.preparationLimit ?? 12,
  );
  for (const preparation of preparations) {
    summary.preparationsExamined += 1;
    ownersAlreadyProcessed.add(preparation.ownerUserId);

    try {
      const result = await advanceWeeklyPackPreparation(
        preparation,
        dependencies,
      );
      if (result.status === "pending") {
        summary.researchPending += 1;
        continue;
      }
      if (
        result.status === "retrying" ||
        result.status === "redesigning"
      ) {
        summary.researchPending += 1;
        continue;
      }
      summary.packsReady += 1;
    } catch (error) {
      summary.preparationFailures += 1;
      await safelyFail(
        dependencies,
        preparation.id,
        "research or composition",
        error,
      );
      if (
        preparation.attemptCount < 3 &&
        isWeeklyPackRetryDay({
          timezone: preparation.timezone,
          now,
        })
      ) {
        // Let the candidate pass claim again in this same daily cycle. Without
        // this, the only Friday invocation can consume the retry window while
        // failing the original preparation, leaving no later Friday run to
        // perform the documented retry.
        ownersAlreadyProcessed.delete(preparation.ownerUserId);
      }
    }
  }

  const maxNewPacks = Math.min(
    Math.max(Math.floor(args.maxNewPacks ?? 2), 0),
    10,
  );
  if (maxNewPacks === 0) return summary;

  const { candidates } = await dependencies.listCandidates(
    args.candidateLimit ?? 50,
  );
  for (const candidate of candidates) {
    if (summary.packsStarted >= maxNewPacks) break;
    summary.candidatesExamined += 1;
    const preparationDay = isWeeklyPackPreparationDay({
      timezone: candidate.timezone,
      now,
    });
    const retryDay = isWeeklyPackRetryDay({
      timezone: candidate.timezone,
      now,
    });
    if (
      ownersAlreadyProcessed.has(candidate.ownerUserId) ||
      (!preparationDay && !retryDay)
    ) {
      continue;
    }
    summary.candidatesEligible += 1;

    let source: WeeklyPackGenerationSource;
    try {
      source = await dependencies.fetchSource(candidate.ownerUserId);
    } catch (error) {
      summary.sourcesUnavailable += 1;
      console.info("[weekly-pack:worker] candidate source unavailable", {
        timezone: candidate.timezone,
        errorName: errorName(error),
      });
      continue;
    }

    const requestId = dependencies.newRequestId();
    const window = weeklyPackWindow({
      timezone: source.timezone,
      now,
    });
    const claim = await dependencies.claimPreparation({
      ownerUserId: source.ownerUserId,
      timezone: source.timezone,
      ...window,
      generationRequestId: requestId,
      retryOnly: retryDay,
    });
    if (!claim.claimed) {
      summary.claimsSkipped += 1;
      continue;
    }
    if (!claim.preparation) {
      throw new Error("Base44 returned an incomplete weekly pack claim.");
    }
    ownersAlreadyProcessed.add(source.ownerUserId);
    summary.packsStarted += 1;

    try {
      await startClaimedWeeklyPack(
        {
          source,
          preparation: claim.preparation,
          requestId,
          weekKey: window.weekKey,
        },
        dependencies,
      );
    } catch (error) {
      summary.preparationFailures += 1;
      await safelyFail(
        dependencies,
        claim.preparation.id,
        "design or research start",
        error,
      );
    }
  }

  return summary;
}

export type { WorkerDependencies as WeeklyPackWorkerDependencies };

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
  startWeeklyPackResearch,
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
  startResearch: typeof startWeeklyPackResearch;
  setResearch: typeof setWeeklyPackResearch;
  newRequestId: () => string;
};

const productionDependencies: WorkerDependencies = {
  listPreparations: listWeeklyPackPreparations,
  pollResearch: pollWeeklyPackResearch,
  composeCards: composeWeeklyExperienceCards,
  completePreparation: completeWeeklyPackPreparation,
  failPreparation: failWeeklyPackPreparation,
  listCandidates: listWeeklyPackCandidates,
  fetchSource: fetchWeeklyPackGenerationSource,
  claimPreparation: claimWeeklyPackPreparation,
  designPack: designWeeklyPack,
  startResearch: startWeeklyPackResearch,
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
  });
  try {
    await dependencies.failPreparation({
      packId,
      error: `${phase} failed (${errorName(error)})`,
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

    let artifact;
    let runs;
    try {
      artifact = weeklyPackDesignArtifactSchema.parse(preparation.design);
      runs = weeklyPackResearchRunsSchema.parse(preparation.researchRuns);
    } catch (error) {
      summary.preparationFailures += 1;
      await safelyFail(
        dependencies,
        preparation.id,
        "stored artifact validation",
        error,
      );
      continue;
    }

    try {
      const research = await dependencies.pollResearch({
        pack: artifact.pack,
        runs,
        homeCity: artifact.homeCity,
        requestId: preparation.generationRequestId,
      });
      if (research.status === "pending") {
        summary.researchPending += 1;
        continue;
      }

      const cards = await dependencies.composeCards({
        pack: artifact.pack,
        research: research.results,
        requestId:
          preparation.generationRequestId ?? dependencies.newRequestId(),
        companion: artifact.companion,
      });
      await dependencies.completePreparation({
        packId: preparation.id,
        cardsJson: JSON.stringify(cards),
        researchJson: JSON.stringify({
          results: research.results,
          audit: research.audit,
        }),
      });
      summary.packsReady += 1;
    } catch (error) {
      summary.preparationFailures += 1;
      await safelyFail(
        dependencies,
        preparation.id,
        "research or composition",
        error,
      );
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
      const context = weeklyPackContextFrom(source, requestId);
      const designed = await dependencies.designPack({
        source: {
          graph: source.graph,
          context,
        },
        requestId,
      });
      const artifact = {
        ...designed,
        homeCity: source.homeCity,
        companion: context.socialMatch
          ? source.socialCandidate?.companion
          : undefined,
      };
      const runs = await dependencies.startResearch({
        pack: artifact.pack,
        context,
        weekKey: window.weekKey,
      });
      await dependencies.setResearch({
        packId: claim.preparation.id,
        designJson: JSON.stringify(artifact),
        researchRunIdsJson: JSON.stringify(runs),
      });
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

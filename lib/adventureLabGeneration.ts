import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";

import type { ExperienceGraphRecord } from "./backendTypes";
import {
  adventureLabBatchFrom,
  adventureLabCopyModelSchema,
  adventureLabCopySchema,
  adventureLabDraftModelSchema,
  adventureLabReviewModelSchema,
  adventureLabReviewSchema,
  auditAdventureLabDraft,
  buildAdventureLabCompositionPrompt,
  buildAdventureLabPrompt,
  buildAdventureLabReviewPrompt,
  describeAdventureLabReviewFailure,
  drawAdventureLabContract,
  enforceAdventureLabReviewThresholds,
  validateAdventureLabCopy,
  type AdventureLabDraftModel,
  type AdventureLabFeedback,
} from "./adventureLab";
import {
  NOW_RESEARCH_OUTPUT_SCHEMA,
  type NowResearchFinding,
} from "./nowChapterSchema";
import { parseGroundedNowResearch } from "./nowGeneration";
import {
  fetchParallelResearchResult,
  startParallelResearch,
} from "./parallelResearch";

const ADVENTURE_LAB_MODEL =
  process.env.CHAPTER_ADVENTURE_LAB_MODEL ||
  "openai/gpt-5.6-terra";
const ADVENTURE_LAB_REVIEW_MODEL =
  process.env.CHAPTER_ADVENTURE_LAB_REVIEW_MODEL ||
  ADVENTURE_LAB_MODEL;
const ADVENTURE_LAB_COMPOSITION_MODEL =
  process.env.CHAPTER_ADVENTURE_LAB_COMPOSITION_MODEL ||
  "openai/gpt-5.6-luna";
const ADVENTURE_LAB_FALLBACK_MODEL =
  process.env.CHAPTER_ADVENTURE_LAB_FALLBACK_MODEL ||
  "google/gemini-3.1-flash-lite";
const ADVENTURE_LAB_SECONDARY_FALLBACK_MODEL =
  process.env.CHAPTER_ADVENTURE_LAB_SECONDARY_FALLBACK_MODEL ||
  "moonshotai/kimi-k2.6";
const ADVENTURE_LAB_MODEL_TIMEOUT_MS = 180_000;
const ADVENTURE_LAB_RESEARCH_TIMEOUT_MS = 12 * 60_000;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  compatibility: "strict",
  appName: "Chapter Adventure Lab",
  appUrl: "https://usechapter.vercel.app",
});

function modelSettings(
  modelId: string,
  reasoning: AdventureLabReasoningEffort,
) {
  const gpt56 = modelId.includes("gpt-5.6-");
  return {
    reasoning: { effort: reasoning },
    provider: {
      ...(gpt56 ? { order: ["azure"] } : {}),
      allow_fallbacks: true,
      data_collection: "deny",
      // The AI SDK emits max_tokens while Azure advertises
      // max_completion_tokens. OpenRouter translates it, but its strict
      // parameter pre-filter would incorrectly remove the only ZDR endpoint.
      require_parameters: !gpt56,
      zdr: true,
    },
  };
}

export class AdventureLabGenerationError extends Error {
  constructor(
    message: string,
    readonly kind: "provider" | "quality" | "research",
  ) {
    super(message);
    this.name = "AdventureLabGenerationError";
  }
}

type AdventureLabReasoningEffort = "none" | "low";

function reasoningEffortFor(
  modelId: string,
  override?: AdventureLabReasoningEffort,
) {
  if (override) return override;
  if (modelId.includes("gpt-5.6-luna")) return "none" as const;
  if (modelId.startsWith("openai/")) return "low" as const;
  return "none" as const;
}

function modelTuning(modelId: string, temperature: number) {
  return modelId.startsWith("openai/") ? {} : { temperature };
}

function fallbackModels(primary: string) {
  return [
    ...new Set([
      ADVENTURE_LAB_FALLBACK_MODEL,
      ADVENTURE_LAB_SECONDARY_FALLBACK_MODEL,
    ]),
  ].filter((modelId) => modelId !== primary);
}

async function generateDraft(args: {
  modelId: string;
  prompt: string;
  requestId: string;
}) {
  const startedAt = Date.now();
  try {
    const result = await generateText({
      model: openrouter(
        args.modelId,
        modelSettings(args.modelId, reasoningEffortFor(args.modelId)),
      ),
      messages: [{ role: "user", content: args.prompt }],
      output: Output.object({
        name: "adventure_lab_experience",
        description:
          "One concrete pre-research Chapter adventure for rapid evaluation.",
        schema: adventureLabDraftModelSchema,
      }),
      ...modelTuning(args.modelId, 0.68),
      maxOutputTokens: 5_000,
      maxRetries: 0,
      timeout: { totalMs: ADVENTURE_LAB_MODEL_TIMEOUT_MS },
    });
    console.info(
      [
        "[adventure-lab:model] completed",
        `requestId=${args.requestId}`,
        `model=${args.modelId}`,
        `elapsedMs=${Date.now() - startedAt}`,
        `inputTokens=${result.usage.inputTokens ?? "unknown"}`,
        `outputTokens=${result.usage.outputTokens ?? "unknown"}`,
      ].join(" "),
    );
    return adventureLabDraftModelSchema.parse(result.output);
  } catch (error) {
    console.warn(
      [
        "[adventure-lab:model] failed",
        `requestId=${args.requestId}`,
        `model=${args.modelId}`,
        `elapsedMs=${Date.now() - startedAt}`,
        `error=${error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError"}`,
      ].join(" "),
    );
    throw error;
  }
}

async function reviewDraft(args: {
  draft: AdventureLabDraftModel;
  contract: ReturnType<typeof drawAdventureLabContract>;
  graph: ExperienceGraphRecord;
  homeCity: string;
  requestId: string;
}) {
  const failures: string[] = [];
  for (const modelId of [
    ADVENTURE_LAB_REVIEW_MODEL,
    ...fallbackModels(ADVENTURE_LAB_REVIEW_MODEL),
  ]) {
    const startedAt = Date.now();
    try {
      const result = await generateText({
        model: openrouter(
          modelId,
          modelSettings(modelId, reasoningEffortFor(modelId)),
        ),
        messages: [
          {
            role: "user",
            content: buildAdventureLabReviewPrompt(args),
          },
        ],
        output: Output.object({
          name: "adventure_lab_review",
          description:
            "A strict independent editorial review of one pre-research Chapter adventure.",
          schema: adventureLabReviewModelSchema,
        }),
        ...modelTuning(modelId, 0.15),
        maxOutputTokens: 3_000,
        maxRetries: 0,
        timeout: { totalMs: ADVENTURE_LAB_MODEL_TIMEOUT_MS },
      });
      const review = enforceAdventureLabReviewThresholds(
        adventureLabReviewSchema.parse(result.output),
      );
      console.info(
        [
          "[adventure-lab:review] completed",
          `requestId=${args.requestId}`,
          `model=${modelId}`,
          `elapsedMs=${Date.now() - startedAt}`,
          `verdict=${review.verdict}`,
          `scores=${JSON.stringify(review.scores)}`,
        ].join(" "),
      );
      return { review, modelId };
    } catch (error) {
      const message =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      failures.push(`${modelId}: ${message}`);
      console.warn(
        [
          "[adventure-lab:review] failed",
          `requestId=${args.requestId}`,
          `model=${modelId}`,
          `elapsedMs=${Date.now() - startedAt}`,
          `error=${message}`,
        ].join(" "),
      );
    }
  }
  throw new AdventureLabGenerationError(
    `No model produced a valid independent review. ${failures.join(" | ")}`,
    "provider",
  );
}

async function composeDraft(args: {
  draft: AdventureLabDraftModel;
  place: {
    name: string;
    area: string;
    address: string;
    bestTime: string;
    priceNote?: string;
  };
  contract: ReturnType<typeof drawAdventureLabContract>;
  graph: ExperienceGraphRecord;
  requestId: string;
}) {
  const failures: string[] = [];
  let correction = "";
  for (const modelId of [
    ADVENTURE_LAB_COMPOSITION_MODEL,
    ...fallbackModels(ADVENTURE_LAB_COMPOSITION_MODEL),
  ]) {
    const startedAt = Date.now();
    try {
      const result = await generateText({
        model: openrouter(
          modelId,
          modelSettings(modelId, reasoningEffortFor(modelId, "none")),
        ),
        messages: [
          {
            role: "user",
            content: [
              buildAdventureLabCompositionPrompt({
                draft: args.draft,
                place: args.place,
              }),
              correction,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
        output: Output.object({
          name: "adventure_lab_final_copy",
          description:
            "Truthful final copy for one designed and researched Chapter adventure.",
          schema: adventureLabCopyModelSchema,
        }),
        ...modelTuning(modelId, 0.25),
        maxOutputTokens: 1_500,
        maxRetries: 0,
        timeout: { totalMs: ADVENTURE_LAB_MODEL_TIMEOUT_MS },
      });
      const copy = adventureLabCopySchema.parse(result.output);
      validateAdventureLabCopy({ copy, place: args.place });
      const composedDraft: AdventureLabDraftModel = {
        ...args.draft,
        experiencePromise: copy.experiencePromise,
        mechanism: {
          ...args.draft.mechanism,
          description: copy.mechanismDescription,
        },
      };
      const audit = auditAdventureLabDraft({
        draft: composedDraft,
        contract: args.contract,
        graph: args.graph,
      });
      if (!audit.valid) {
        throw new Error(
          audit.issues
            .map((issue) => `${issue.code}: ${issue.message}`)
            .join("\n"),
        );
      }
      console.info(
        [
          "[adventure-lab:composition] completed",
          `requestId=${args.requestId}`,
          `model=${modelId}`,
          `elapsedMs=${Date.now() - startedAt}`,
        ].join(" "),
      );
      return { draft: composedDraft, modelId };
    } catch (error) {
      const message =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      failures.push(`${modelId}: ${message}`);
      correction = [
        "The previous final copy failed a deterministic truth gate.",
        "Return both fields again and repair this exact failure without changing the accepted action or adding facts:",
        message,
      ].join("\n");
      console.warn(
        [
          "[adventure-lab:composition] failed",
          `requestId=${args.requestId}`,
          `model=${modelId}`,
          `elapsedMs=${Date.now() - startedAt}`,
          `error=${message}`,
        ].join(" "),
      );
    }
  }
  throw new AdventureLabGenerationError(
    `No model produced truthful final copy. ${failures.join(" | ")}`,
    "quality",
  );
}

async function researchDraft(args: {
  draft: AdventureLabDraftModel;
  homeCity: string;
  requestId: string;
}): Promise<{
  finding: NowResearchFinding;
  evidence: { url: string; title?: string }[];
}> {
  if (!process.env.PARALLEL_API_KEY) {
    throw new AdventureLabGenerationError(
      "PARALLEL_API_KEY is not configured.",
      "research",
    );
  }

  const input = [
    "Find one exact, currently operating real-world place that makes this already-designed Chapter adventure genuinely possible.",
    "Do not redesign the adventure, soften it into an ordinary recommendation, or substitute a plausible-sounding place.",
    "The place must support the actual action. A restaurant meal, purchase, or passive observation task is not a substitute for participation.",
    `Start from ${args.homeCity} and respect the experience's stated geography and duration.`,
    "Prove the exact name, arrival address, current operation, relevant hours or event date, booking method when needed, and price when a source states it.",
    "If no real current place supports the designed action, the research has failed.",
    "",
    "DESIGNED ACTION",
    args.draft.experiencePromise,
    "",
    "MECHANISM",
    args.draft.mechanism.description,
    "",
    "RESEARCH OBJECTIVE",
    args.draft.researchObjective,
  ].join("\n");
  const startedAt = Date.now();
  const { runId } = await startParallelResearch({
    input,
    outputSchema: NOW_RESEARCH_OUTPUT_SCHEMA as unknown as Record<
      string,
      unknown
    >,
    metadata: {
      app: "chapter",
      surface: "adventure-lab",
      request_id: args.requestId,
    },
  });
  console.info(
    `[adventure-lab:research] started requestId=${args.requestId} runId=${runId}`,
  );

  while (Date.now() - startedAt < ADVENTURE_LAB_RESEARCH_TIMEOUT_MS) {
    const result = await fetchParallelResearchResult(runId, 20);
    if (result.status === "pending") continue;
    if (result.status === "failed") {
      throw new AdventureLabGenerationError(
        "Live research could not prove a real place for the designed action.",
        "research",
      );
    }
    const finding = parseGroundedNowResearch({
      researchContent: result.content,
      citations: result.citations,
    });
    console.info(
      [
        "[adventure-lab:research] completed",
        `requestId=${args.requestId}`,
        `runId=${runId}`,
        `elapsedMs=${Date.now() - startedAt}`,
        `venue=${JSON.stringify(finding.venue_name)}`,
      ].join(" "),
    );
    return {
      finding,
      evidence: result.citations.slice(0, 4),
    };
  }

  throw new AdventureLabGenerationError(
    "Live research did not finish within twelve minutes.",
    "research",
  );
}

export async function craftAdventureLabExperience(args: {
  graph: ExperienceGraphRecord;
  homeCity: string;
  feedback: readonly AdventureLabFeedback[];
  requestId: string;
}) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new AdventureLabGenerationError(
      "OPENROUTER_API_KEY is not configured.",
      "provider",
    );
  }

  const contract = drawAdventureLabContract(args.graph, args.requestId);
  const models = [
    ADVENTURE_LAB_MODEL,
    ADVENTURE_LAB_MODEL,
    ...fallbackModels(ADVENTURE_LAB_MODEL),
  ];
  const failures: string[] = [];
  let correction = "";
  let receivedDraft = false;
  let researchWasStarted = false;

  for (const modelId of models) {
    try {
      const draft = await generateDraft({
        modelId,
        requestId: args.requestId,
        prompt: buildAdventureLabPrompt({
          graph: args.graph,
          homeCity: args.homeCity,
          contract,
          feedback: args.feedback,
          correction,
        }),
      });
      receivedDraft = true;
      const normalizedDraft =
        contract.contextDimension === null
          ? { ...draft, supportingContextDescription: null }
          : draft;
      const audit = auditAdventureLabDraft({
        draft: normalizedDraft,
        contract,
        graph: args.graph,
      });
      if (audit.valid) {
        const reviewed = await reviewDraft({
          draft: normalizedDraft,
          contract,
          graph: args.graph,
          homeCity: args.homeCity,
          requestId: args.requestId,
        });
        if (reviewed.review.verdict !== "accept") {
          const failure = describeAdventureLabReviewFailure(
            reviewed.review,
          );
          failures.push(`${modelId} review: ${failure}`);
          correction = [
            "The previous adventure passed structural checks but failed an independent Chapter editor.",
            "Return the complete adventure again and repair the concrete weaknesses without changing the pre-drawn contract.",
            `PREVIOUS REJECTED ADVENTURE: ${JSON.stringify(normalizedDraft)}`,
            "EDITOR REVIEW:",
            failure,
          ].join("\n");
          continue;
        }

        let researched: Awaited<ReturnType<typeof researchDraft>>;
        try {
          researchWasStarted = true;
          researched = await researchDraft({
            draft: normalizedDraft,
            homeCity: args.homeCity,
            requestId: args.requestId,
          });
        } catch (error) {
          if (
            error instanceof AdventureLabGenerationError &&
            error.kind === "research"
          ) {
            throw error;
          }
          throw new AdventureLabGenerationError(
            error instanceof Error
              ? error.message
              : "Live research could not prove the designed action.",
            "research",
          );
        }
        const place = {
          name: researched.finding.venue_name,
          area: researched.finding.venue_area,
          address: researched.finding.address,
          bestTime: researched.finding.best_time,
          priceNote: researched.finding.price_note ?? undefined,
        };
        const composed = await composeDraft({
          draft: normalizedDraft,
          place,
          contract,
          graph: args.graph,
          requestId: args.requestId,
        });
        return {
          batch: adventureLabBatchFrom(
            args.requestId,
            contract,
            composed.draft,
            {
              place,
              evidence: researched.evidence,
            },
          ),
          modelId,
          reviewModelId: reviewed.modelId,
          compositionModelId: composed.modelId,
        };
      }
      const failure = audit.issues
        .map((issue) => `${issue.code}: ${issue.message}`)
        .join("\n");
      failures.push(`${modelId}: ${failure}`);
      correction = [
        "The previous adventure failed the executable Chapter checks.",
        "Return the complete adventure again and repair every issue without changing the pre-drawn contract.",
        `PREVIOUS INVALID ADVENTURE: ${JSON.stringify(normalizedDraft)}`,
        "EXACT FAILURES:",
        failure,
      ].join("\n");
    } catch (error) {
      if (researchWasStarted) {
        throw error;
      }
      failures.push(
        `${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new AdventureLabGenerationError(
    failures.join(" | "),
    receivedDraft ? "quality" : "provider",
  );
}

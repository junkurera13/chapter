import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { ExperienceGraphRecord } from "./backendTypes";
import { fetchParallelResearchResult, startParallelResearch } from "./parallelResearch";
import { findVenuePhoto } from "./venuePhoto";
import {
  auditWeeklyPackDesign,
  auditWeeklyPackResearch,
  buildWeeklyPackDesignPrompt,
  buildWeeklyPackResearchPrompt,
  buildWeeklyPackRevisionPrompt,
  buildWeeklyPackReviewPrompt,
  canonicalizeWeeklyPackAnchors,
  enforceWeeklyPackReviewThresholds,
  weeklyPackDesignModelSchema,
  weeklyPackDesignSchema,
  weeklyPackResearchFindingSchema,
  weeklyPackReviewModelSchema,
  weeklyPackReviewSchema,
  type WeeklyPackContext,
  type WeeklyPackDesign,
  type WeeklyPackReview,
  type WeeklyPackResearchFinding,
  type WeeklyPackScale,
} from "./weeklyPackDesign";
import {
  weeklyExperienceCardSchema,
  type WeeklyExperienceCard,
} from "./weeklyPackSchema";
import { generateWeeklyPackImage } from "./weeklyPackImageGeneration";
import {
  WEEKLY_PACK_PERSON_TOKEN,
  containsAnonymousPersonLanguage,
  resolveWeeklyPersonToken,
  type WeeklyPackCompanion,
} from "./weeklyPackSocial";

const PACK_MODEL_ID =
  process.env.CHAPTER_PACK_MODEL || "anthropic/claude-sonnet-5";
const PACK_FALLBACK_MODEL_ID =
  process.env.CHAPTER_PACK_FALLBACK_MODEL || "moonshotai/kimi-k2.6";
const PACK_REVIEW_MODEL_ID =
  process.env.CHAPTER_PACK_REVIEW_MODEL || PACK_MODEL_ID;
const PACK_REVISION_MODEL_ID =
  process.env.CHAPTER_PACK_REVISION_MODEL || PACK_MODEL_ID;
const PACK_COMPOSITION_MODEL_ID =
  process.env.CHAPTER_PACK_COMPOSITION_MODEL || PACK_MODEL_ID;
const PACK_PROCESSOR =
  process.env.CHAPTER_PACK_PROCESSOR ||
  process.env.CHAPTER_NOW_PROCESSOR ||
  "core";

const BASELINE_REQUIREMENTS = {
  availability:
    "Verify that the experience and every critical dependency are currently available within the intended validity window.",
  cost:
    "Verify the complete expected cost, including booking, materials, admission, and transport.",
  travel:
    "Verify a practical outward and return journey, including the final arrival point and cutoff times.",
} as const;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  compatibility: "strict",
  appName: "Chapter",
  appUrl: "https://usechapter.vercel.app",
  extraBody: {
    provider: {
      allow_fallbacks: true,
      data_collection: "deny",
      require_parameters: true,
      zdr: true,
    },
  },
});

export class WeeklyPackGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyPackGenerationError";
  }
}

export const weeklyPackResearchRunSchema = z.object({
  cardId: z.enum(["small", "mini", "proper"]),
  runId: z.string().trim().min(1).max(160),
});

export const weeklyPackResearchRunsSchema = z
  .array(weeklyPackResearchRunSchema)
  .length(3);

export type WeeklyPackResearchRun = z.infer<
  typeof weeklyPackResearchRunSchema
>;

export const weeklyPackResearchResultSchema = z.object({
  cardId: z.enum(["small", "mini", "proper"]),
  runId: z.string().trim().min(1).max(160),
  finding: weeklyPackResearchFindingSchema,
  citations: z.array(
    z.object({
      url: z.string().url(),
      title: z.string().trim().min(1).max(300).optional(),
    }),
  ),
});

export type WeeklyPackResearchResult = z.infer<
  typeof weeklyPackResearchResultSchema
>;

const weeklyPackCopyModelSchema = z.object({
  cards: z.array(
    z.object({
      id: z.enum(["small", "mini", "proper"]),
      title: z.string(),
      line: z.string(),
      promise: z.string(),
      opening: z.string(),
      steps: z.array(z.string()),
    }),
  ),
});

const weeklyPackCopySchema = z.object({
  cards: z
    .array(
      z.object({
        id: z.enum(["small", "mini", "proper"]),
        title: z.string().trim().min(3).max(120),
        line: z.string().trim().min(20).max(240),
        promise: z.string().trim().min(20).max(500),
        opening: z.string().trim().min(20).max(1_000),
        steps: z.array(z.string().trim().min(8).max(500)).min(1).max(8),
      }),
    )
    .length(3),
});

type PackGenerationSource = {
  graph: ExperienceGraphRecord;
  context: WeeklyPackContext;
};

function modelTuning(modelId: string, temperature: number) {
  if (modelId.startsWith("anthropic/")) {
    return { reasoning: "low" as const };
  }
  if (modelId.startsWith("openai/")) {
    return { reasoning: "minimal" as const };
  }
  return { reasoning: "none" as const, temperature };
}

async function generateObject<T>(args: {
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  modelId: string;
  temperature: number;
  maxOutputTokens: number;
  requestId: string;
}) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new WeeklyPackGenerationError(
      "OPENROUTER_API_KEY is not configured.",
    );
  }
  const startedAt = Date.now();
  try {
    const result = await generateText({
      model: openrouter(args.modelId),
      messages: [{ role: "user", content: args.prompt }],
      output: Output.object({
        name: args.schemaName,
        description:
          "A strict Chapter weekly experience-pack production artifact.",
        schema: args.schema,
      }),
      ...modelTuning(args.modelId, args.temperature),
      maxOutputTokens: args.maxOutputTokens,
      maxRetries: 0,
      timeout: { totalMs: 120_000 },
    });
    console.info(
      [
        "[weekly-pack:generate] call completed",
        `requestId=${args.requestId}`,
        `schema=${args.schemaName}`,
        `model=${args.modelId}`,
        `elapsedMs=${Date.now() - startedAt}`,
      ].join(" "),
    );
    return args.schema.parse(result.output);
  } catch (error) {
    console.warn(
      [
        "[weekly-pack:generate] call failed",
        `requestId=${args.requestId}`,
        `schema=${args.schemaName}`,
        `model=${args.modelId}`,
        `elapsedMs=${Date.now() - startedAt}`,
        `error=${error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError"}`,
      ].join(" "),
    );
    throw error;
  }
}

function normalizeDesign(
  output: z.infer<typeof weeklyPackDesignModelSchema>,
  source: PackGenerationSource,
) {
  const candidate = weeklyPackDesignSchema.parse({
    ...output,
    cards: output.cards.map((card) => {
      const present = new Set(
        card.requirements.map((requirement) => requirement.kind),
      );
      return {
        ...card,
        requirements: [
          ...card.requirements,
          ...Object.entries(BASELINE_REQUIREMENTS).flatMap(([kind, detail]) =>
            present.has(kind as keyof typeof BASELINE_REQUIREMENTS)
              ? []
              : [
                  {
                    kind: kind as keyof typeof BASELINE_REQUIREMENTS,
                    detail,
                  },
                ],
          ),
        ],
      };
    }),
  });
  return canonicalizeWeeklyPackAnchors(candidate, source.graph);
}

type WeeklyPackModelAttempt<T> =
  | { value: T }
  | { failure: string; correction: string };

export async function runWeeklyPackModelAttempts<T>(args: {
  modelIds: readonly string[];
  attemptsPerModel?: number;
  attempt: (args: {
    modelId: string;
    attempt: number;
    correction: string;
  }) => Promise<WeeklyPackModelAttempt<T>>;
}) {
  const failures: string[] = [];
  let correction = "";
  const attemptsPerModel = Math.max(
    1,
    Math.floor(args.attemptsPerModel ?? 2),
  );

  for (const modelId of args.modelIds) {
    for (let attempt = 1; attempt <= attemptsPerModel; attempt += 1) {
      const result = await args.attempt({ modelId, attempt, correction });
      if ("value" in result) {
        return { value: result.value, failures };
      }
      failures.push(
        `${modelId} attempt ${attempt}: ${result.failure}`,
      );
      correction = result.correction;
    }
  }

  return { failures };
}

async function structurallyValidDesign(args: {
  prompt: string;
  source: PackGenerationSource;
  modelIds: readonly string[];
  schemaName: string;
  requestId: string;
  temperature: number;
}) {
  const result = await runWeeklyPackModelAttempts({
    modelIds: args.modelIds,
    attemptsPerModel: 2,
    attempt: async ({ modelId, correction }) => {
      try {
        const output = await generateObject({
          prompt: [args.prompt, correction].filter(Boolean).join("\n\n"),
          schema: weeklyPackDesignModelSchema,
          schemaName: args.schemaName,
          modelId,
          temperature: args.temperature,
          maxOutputTokens: 16_000,
          requestId: args.requestId,
        });
        const pack = normalizeDesign(output, args.source);
        const audit = auditWeeklyPackDesign({
          pack,
          graph: args.source.graph,
          context: args.source.context,
        });
        if (audit.valid) return { value: pack };

        const failure = audit.errors
          .map((issue) => `${issue.code}: ${issue.message}`)
          .join("\n");
        return {
          failure,
          correction: [
            "The previous full pack failed deterministic gates.",
            "Return all three cards again. Repair every failure without weakening the one-stretch, format, social, privacy, or evidence contracts.",
            `PREVIOUS INVALID PACK: ${JSON.stringify(pack)}`,
            "EXACT FAILURES:",
            failure,
          ].join("\n"),
        };
      } catch (error) {
        const failure =
          error instanceof Error ? error.message : String(error);
        return {
          failure,
          correction: [
            correction,
            "The previous attempt did not return a valid structured pack.",
            "Return one complete pack with exactly three cards and every required field. Do not include commentary outside the structured result.",
          ]
            .filter(Boolean)
            .join("\n"),
        };
      }
    },
  });
  if (result.value) {
    return result.value;
  }
  throw new WeeklyPackGenerationError(
    `No model produced a structurally valid pack. ${result.failures.join(" | ")}`,
  );
}

async function reviewDesign(args: {
  pack: WeeklyPackDesign;
  source: PackGenerationSource;
  requestId: string;
}) {
  const prompt = buildWeeklyPackReviewPrompt({
    pack: args.pack,
    graph: args.source.graph,
    context: args.source.context,
  });
  const modelIds = [
    PACK_REVIEW_MODEL_ID,
    ...(PACK_FALLBACK_MODEL_ID === PACK_REVIEW_MODEL_ID
      ? []
      : [PACK_FALLBACK_MODEL_ID]),
  ];
  const failures: string[] = [];

  for (const modelId of modelIds) {
    try {
      const output = await generateObject({
        prompt,
        schema: weeklyPackReviewModelSchema,
        schemaName: "weekly_pack_review",
        modelId,
        temperature: 0.15,
        maxOutputTokens: 8_000,
        requestId: args.requestId,
      });
      return enforceWeeklyPackReviewThresholds(
        weeklyPackReviewSchema.parse(output),
      );
    } catch (error) {
      failures.push(
        `${modelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new WeeklyPackGenerationError(
    `No model produced a valid independent review. ${failures.join(" | ")}`,
  );
}

export async function designWeeklyPack(args: {
  source: PackGenerationSource;
  requestId: string;
}) {
  const modelIds = [
    PACK_MODEL_ID,
    ...(PACK_FALLBACK_MODEL_ID === PACK_MODEL_ID
      ? []
      : [PACK_FALLBACK_MODEL_ID]),
  ];
  let pack = await structurallyValidDesign({
    prompt: buildWeeklyPackDesignPrompt({
      graph: args.source.graph,
      context: args.source.context,
    }),
    source: args.source,
    modelIds,
    schemaName: "weekly_pack_design",
    requestId: args.requestId,
    temperature: 0.72,
  });
  let review = await reviewDesign({
    pack,
    source: args.source,
    requestId: args.requestId,
  });
  const revisionReviews: WeeklyPackReview[] = [];

  for (let round = 0; review.verdict !== "accept" && round < 2; round += 1) {
    revisionReviews.push(review);
    pack = await structurallyValidDesign({
      prompt: buildWeeklyPackRevisionPrompt({
        pack,
        review,
        graph: args.source.graph,
        context: args.source.context,
      }),
      source: args.source,
      modelIds: [
        PACK_REVISION_MODEL_ID,
        ...(PACK_FALLBACK_MODEL_ID === PACK_REVISION_MODEL_ID
          ? []
          : [PACK_FALLBACK_MODEL_ID]),
      ],
      schemaName: "weekly_pack_revision",
      requestId: args.requestId,
      temperature: 0.48,
    });
    review = await reviewDesign({
      pack,
      source: args.source,
      requestId: args.requestId,
    });
  }

  if (review.verdict !== "accept") {
    throw new WeeklyPackGenerationError(
      "The weekly pack did not pass independent editorial review.",
    );
  }
  return { pack, review, revisionReviews };
}

export async function startWeeklyPackResearch(args: {
  pack: WeeklyPackDesign;
  context: WeeklyPackContext;
  weekKey: string;
}) {
  const runs = await Promise.all(
    args.pack.cards.map(async (card) => {
      const { runId } = await startParallelResearch({
        processor: PACK_PROCESSOR,
        input: buildWeeklyPackResearchPrompt({
          card,
          context: args.context,
          currentDate: new Date().toISOString().slice(0, 10),
        }),
        outputSchema: z.toJSONSchema(
          weeklyPackResearchFindingSchema,
        ) as Record<string, unknown>,
        metadata: {
          app: "chapter",
          surface: "weekly-pack",
          week: args.weekKey,
          card: card.id,
        },
      });
      return { cardId: card.id, runId };
    }),
  );
  return weeklyPackResearchRunsSchema.parse(runs);
}

export async function pollWeeklyPackResearch(args: {
  pack: WeeklyPackDesign;
  runs: WeeklyPackResearchRun[];
}) {
  const results = await Promise.all(
    args.runs.map(async (run) => ({
      run,
      result: await fetchParallelResearchResult(run.runId, 2),
    })),
  );
  if (results.some(({ result }) => result.status === "failed")) {
    throw new WeeklyPackGenerationError(
      "One of the three weekly research runs failed.",
    );
  }
  if (results.some(({ result }) => result.status === "pending")) {
    return { status: "pending" as const };
  }

  const completed = results.map(({ run, result }) => {
    if (result.status !== "completed") {
      throw new WeeklyPackGenerationError("Research is not complete.");
    }
    const raw =
      typeof result.content === "string"
        ? JSON.parse(result.content)
        : result.content;
    const finding = weeklyPackResearchFindingSchema.parse(raw);
    if (finding.cardId !== run.cardId) {
      throw new WeeklyPackGenerationError(
        `Research for ${run.cardId} returned the wrong card id.`,
      );
    }
    return weeklyPackResearchResultSchema.parse({
      cardId: run.cardId,
      runId: run.runId,
      finding,
      citations: result.citations,
    });
  });
  const audit = auditWeeklyPackResearch({
    pack: args.pack,
    findings: completed.map((result) => result.finding),
  });
  if (!audit.valid) {
    throw new WeeklyPackGenerationError(
      `Weekly research failed pack audit: ${audit.errors
        .map((issue) => issue.code)
        .join(", ")}.`,
    );
  }
  return { status: "completed" as const, results: completed, audit };
}

export function buildWeeklyPackCompositionPrompt(args: {
  pack: WeeklyPackDesign;
  research: WeeklyPackResearchResult[];
  companion?: WeeklyPackCompanion;
}) {
  return [
    "Write the visible copy for three already-designed, already-researched Chapter cards.",
    "Return exactly one small, one mini, and one proper card.",
    "",
    "COPY CONTRACT",
    "- Preserve the researched action, place, route, company, scale, and logistics. Do not redesign anything.",
    "- Use only claims present in the design and research. Do not invent biography, preference, emotion, safety, availability, cost, or travel facts.",
    "- Title: plain, specific, 3-9 words.",
    "- Line: one natural sentence, 12-32 words, that presents the experience as an invitation. Use 1-3 accepted anchor labels verbatim where they fit naturally so the interface can mark those real graph nodes.",
    "- Promise: one concrete sentence stating what the person will actually do.",
    "- Opening: 1-2 unhurried sentences that make the action legible without explaining personalization.",
    "- Steps: 2-5 concise actions forming the researched rhythm or route. Do not pad a small activity into an itinerary.",
    "- No marketing language, destiny, exclamation marks, compatibility claims, or mention of Chapter's machinery.",
    args.companion
      ? [
          `- One social card has a real server-confirmed person. Refer to that person with the exact token ${WEEKLY_PACK_PERSON_TOKEN}; the server replaces it with their actual name after generation.`,
          `- The social card's line must contain ${WEEKLY_PACK_PERSON_TOKEN}.`,
          "- Never write someone new, a new person, a stranger, someone you know, a friend, bring someone, or another anonymous substitute.",
        ].join("\n")
      : "- No matched person exists. Do not write a social card or suggest bringing somebody.",
    "",
    `ACCEPTED DESIGN: ${JSON.stringify(args.pack)}`,
    `VERIFIED RESEARCH: ${JSON.stringify(args.research)}`,
  ].join("\n");
}

export function validateWeeklyPackSocialCopy(args: {
  pack: WeeklyPackDesign;
  copy: z.infer<typeof weeklyPackCopySchema>;
  companion?: WeeklyPackCompanion;
}) {
  const socialDesigns = args.pack.cards.filter(
    (card) => card.format.company !== "self",
  );
  if (!args.companion) {
    if (socialDesigns.length > 0) {
      throw new WeeklyPackGenerationError(
        "A social card was composed without a real person.",
      );
    }
    return;
  }
  if (socialDesigns.length !== 1) {
    throw new WeeklyPackGenerationError(
      "A matched person must belong to exactly one card.",
    );
  }

  const design = socialDesigns[0];
  const expectedCompany =
    args.companion.familiarity === "new" ? "new-person" : "known-person";
  if (design.format.company !== expectedCompany) {
    throw new WeeklyPackGenerationError(
      "The social card does not match the real person's familiarity.",
    );
  }
  const copy = args.copy.cards.find((card) => card.id === design.id);
  if (!copy) {
    throw new WeeklyPackGenerationError("The social card copy is missing.");
  }
  if (!copy.line.includes(WEEKLY_PACK_PERSON_TOKEN)) {
    throw new WeeklyPackGenerationError(
      "The social card line did not identify its real person.",
    );
  }
  const visibleCopy = [
    copy.title,
    copy.line,
    copy.promise,
    copy.opening,
    ...copy.steps,
  ].join("\n");
  if (containsAnonymousPersonLanguage(visibleCopy)) {
    throw new WeeklyPackGenerationError(
      "The social card used anonymous person language.",
    );
  }
}

const PRACTICAL_LABELS: Record<
  keyof WeeklyPackResearchFinding["logistics"],
  string
> = {
  availability: "Availability",
  booking: "Booking",
  cost: "Cost",
  travel: "Travel",
  equipment: "Bring",
  accessibility: "Access",
  weather: "Weather",
  safety: "Safety",
};

export function materializeWeeklyExperienceCards(args: {
  pack: WeeklyPackDesign;
  research: WeeklyPackResearchResult[];
  copy: z.infer<typeof weeklyPackCopySchema>;
  companion?: WeeklyPackCompanion;
  images?: Partial<
    Record<
      WeeklyPackScale,
      NonNullable<WeeklyExperienceCard["image"]> | undefined
    >
  >;
}): WeeklyExperienceCard[] {
  validateWeeklyPackSocialCopy(args);
  const cards = args.pack.cards.map((design) => {
    const result = args.research.find(
      (candidate) => candidate.cardId === design.id,
    );
    const copy = args.copy.cards.find(
      (candidate) => candidate.id === design.id,
    );
    if (!result || !copy) {
      throw new WeeklyPackGenerationError(
        `Finished card ${design.id} is incomplete.`,
      );
    }
    const sourceUrls = Array.from(
      new Set([
        ...result.finding.criticalFacts.flatMap((fact) => fact.sourceUrls),
        ...result.citations.map((citation) => citation.url),
      ]),
    );
    const social = design.format.company !== "self";
    const visibleCopy = social && args.companion
      ? {
          title: resolveWeeklyPersonToken(copy.title, args.companion),
          line: resolveWeeklyPersonToken(copy.line, args.companion),
          promise: resolveWeeklyPersonToken(copy.promise, args.companion),
          opening: resolveWeeklyPersonToken(copy.opening, args.companion),
          steps: copy.steps.map((step) =>
            resolveWeeklyPersonToken(step, args.companion!),
          ),
        }
      : copy;
    return weeklyExperienceCardSchema.parse({
      id: design.id,
      scale: design.format.scale,
      company: design.format.company,
      title: visibleCopy.title,
      line: visibleCopy.line,
      anchors: design.anchors,
      promise: visibleCopy.promise,
      opening: visibleCopy.opening,
      durationMinutes: design.format.durationMinutes,
      place: result.finding.primaryPlace,
      ...(social ? { companion: args.companion } : {}),
      steps: visibleCopy.steps,
      practical: Object.entries(result.finding.logistics).map(
        ([key, value]) => ({
          label:
            PRACTICAL_LABELS[
              key as keyof WeeklyPackResearchFinding["logistics"]
            ],
          value,
        }),
      ),
      sourceUrls,
      image: args.images?.[design.id] ?? null,
    });
  });
  return z.array(weeklyExperienceCardSchema).length(3).parse(cards);
}

export async function composeWeeklyExperienceCards(args: {
  pack: WeeklyPackDesign;
  research: WeeklyPackResearchResult[];
  requestId: string;
  companion?: WeeklyPackCompanion;
}) {
  const modelIds = [
    PACK_COMPOSITION_MODEL_ID,
    ...(PACK_FALLBACK_MODEL_ID === PACK_COMPOSITION_MODEL_ID
      ? []
      : [PACK_FALLBACK_MODEL_ID]),
  ];
  let copy: z.infer<typeof weeklyPackCopySchema> | undefined;
  const failures: string[] = [];
  let correction = "";
  for (const modelId of modelIds) {
    try {
      const output = await generateObject({
        prompt: [
          buildWeeklyPackCompositionPrompt(args),
          correction,
        ].filter(Boolean).join("\n\n"),
        schema: weeklyPackCopyModelSchema,
        schemaName: "weekly_pack_card_copy",
        modelId,
        temperature: 0.3,
        maxOutputTokens: 5_000,
        requestId: args.requestId,
      });
      const candidate = weeklyPackCopySchema.parse(output);
      validateWeeklyPackSocialCopy({
        pack: args.pack,
        copy: candidate,
        companion: args.companion,
      });
      copy = candidate;
      break;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      failures.push(`${modelId}: ${message}`);
      correction = [
        "The previous complete copy set failed a deterministic truth gate.",
        "Return all three cards again and repair this failure:",
        message,
      ].join("\n");
    }
  }
  if (!copy) {
    throw new WeeklyPackGenerationError(
      `No model produced truthful social copy. ${failures.join(" | ")}`,
    );
  }
  const images = Object.fromEntries(
    await Promise.all(
      args.pack.cards.map(async (design) => {
        const result = args.research.find(
          (candidate) => candidate.cardId === design.id,
        );
        const cardCopy = copy.cards.find(
          (candidate) => candidate.id === design.id,
        );
        if (!result || !cardCopy) {
          throw new WeeklyPackGenerationError(
            `Image input for ${design.id} is incomplete.`,
          );
        }

        try {
          return [
            design.id,
            await generateWeeklyPackImage({
              design,
              finding: result.finding,
              copy: cardCopy,
              requestId: args.requestId,
            }),
          ] as const;
        } catch (error) {
          console.warn("[weekly-pack:image] generation unavailable", {
            requestId: args.requestId,
            cardId: design.id,
            errorName:
              error instanceof Error ? error.name : "UnknownError",
          });
          const fallbackUrl = await findVenuePhoto(result.citations);
          return [
            design.id,
            fallbackUrl
              ? {
                  url: fallbackUrl,
                  alt: result.finding.primaryPlace
                    ? `A view of ${result.finding.primaryPlace.name}`
                    : `A photograph connected to ${cardCopy.title}`,
                  kind: "photograph" as const,
                }
              : undefined,
          ] as const;
        }
      }),
    ),
  ) as Partial<
    Record<
      WeeklyPackScale,
      NonNullable<WeeklyExperienceCard["image"]> | undefined
    >
  >;
  return materializeWeeklyExperienceCards({
    pack: args.pack,
    research: args.research,
    copy,
    companion: args.companion,
    images,
  });
}

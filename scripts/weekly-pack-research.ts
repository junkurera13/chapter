import { z } from "zod";

import {
  auditWeeklyPackResearch,
  buildWeeklyPackResearchPrompt,
  weeklyPackResearchFindingSchema,
  type WeeklyPackDesign,
  type WeeklyPackResearchFinding,
} from "../lib/weeklyPackDesign";
import type { WeeklyPackFixture } from "./weekly-pack-fixtures";

const PARALLEL_ORIGIN = "https://api.parallel.ai";
const DEFAULT_PROCESSOR =
  process.env.CHAPTER_PACK_PROCESSOR ||
  process.env.CHAPTER_NOW_PROCESSOR ||
  "core";

const runStatusSchema = z.enum([
  "queued",
  "action_required",
  "running",
  "completed",
  "failed",
  "cancelling",
  "cancelled",
]);

const createRunResponseSchema = z.object({
  run_id: z.string().min(1),
  status: runStatusSchema,
});

const citationSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
});

const resultResponseSchema = z.object({
  run: z.object({
    run_id: z.string(),
    status: runStatusSchema,
  }),
  output: z
    .object({
      content: z.unknown(),
      basis: z
        .array(
          z.object({
            citations: z.array(citationSchema).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

type ResearchResult = {
  runId: string;
  finding: WeeklyPackResearchFinding;
  citations: { url: string; title?: string }[];
};

function parallelApiKey() {
  const key = process.env.PARALLEL_API_KEY;
  if (!key) {
    throw new Error("PARALLEL_API_KEY is not configured.");
  }
  return key;
}

async function startRun(args: {
  input: string;
  fixtureId: string;
  cardId: string;
}) {
  const response = await fetch(`${PARALLEL_ORIGIN}/v1/tasks/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": parallelApiKey(),
    },
    body: JSON.stringify({
      processor: DEFAULT_PROCESSOR,
      input: args.input,
      metadata: {
        app: "chapter",
        surface: "weekly-pack-lab",
        fixture: args.fixtureId,
        card: args.cardId,
      },
      task_spec: {
        output_schema: {
          type: "json",
          json_schema: z.toJSONSchema(weeklyPackResearchFindingSchema),
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Parallel could not start ${args.cardId} research (${response.status}).`,
    );
  }
  return createRunResponseSchema.parse(payload).run_id;
}

async function fetchResult(runId: string) {
  let response: Response;
  try {
    response = await fetch(
      `${PARALLEL_ORIGIN}/v1/tasks/runs/${encodeURIComponent(runId)}/result?timeout=20`,
      {
        headers: { "x-api-key": parallelApiKey() },
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /abort|timeout/i.test(`${error.name} ${error.message}`)
    ) {
      return null;
    }
    throw error;
  }
  if (response.status === 408) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Parallel could not return research ${runId} (${response.status}).`,
    );
  }
  const parsed = resultResponseSchema.parse(payload);
  if (
    parsed.run.status === "failed" ||
    parsed.run.status === "cancelled"
  ) {
    throw new Error(`Parallel research ${runId} ${parsed.run.status}.`);
  }
  if (parsed.run.status !== "completed" || !parsed.output) return null;

  const content =
    typeof parsed.output.content === "string"
      ? JSON.parse(parsed.output.content)
      : parsed.output.content;
  const finding = weeklyPackResearchFindingSchema.parse(content);
  const citations = (parsed.output.basis ?? [])
    .flatMap((entry) => entry.citations ?? [])
    .filter(
      (citation, index, all) =>
        all.findIndex((candidate) => candidate.url === citation.url) === index,
    );
  return { runId, finding, citations };
}

async function waitForResult(runId: string): Promise<ResearchResult> {
  const deadline = Date.now() + 12 * 60 * 1_000;
  while (Date.now() < deadline) {
    const result = await fetchResult(runId);
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Parallel research ${runId} exceeded 12 minutes.`);
}

/**
 * Intentionally starts one independent paid research run per card. This
 * function is only called behind the CLI's explicit confirmation flag.
 */
export async function researchWeeklyPack(args: {
  fixture: WeeklyPackFixture;
  pack: WeeklyPackDesign;
}) {
  const currentDate = new Date().toISOString().slice(0, 10);
  const starts = await Promise.all(
    args.pack.cards.map(async (card) => ({
      cardId: card.id,
      runId: await startRun({
        input: buildWeeklyPackResearchPrompt({
          card,
          context: args.fixture.context,
          currentDate,
        }),
        fixtureId: args.fixture.id,
        cardId: card.id,
      }),
    })),
  );

  const results = await Promise.all(
    starts.map(({ runId }) => waitForResult(runId)),
  );
  const findings = results.map((result) => result.finding);
  return {
    processor: DEFAULT_PROCESSOR,
    runs: results,
    audit: auditWeeklyPackResearch({ pack: args.pack, findings }),
  };
}

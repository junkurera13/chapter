import "server-only";

import { z } from "zod";

const PARALLEL_ORIGIN = "https://api.parallel.ai";
const DEFAULT_PROCESSOR = process.env.CHAPTER_NOW_PROCESSOR || "core";

export class ParallelResearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ParallelResearchError";
  }
}

function apiKey() {
  const key = process.env.PARALLEL_API_KEY;
  if (!key) {
    throw new ParallelResearchError(
      "PARALLEL_API_KEY is not configured.",
      500,
    );
  }
  return key;
}

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
  excerpts: z.array(z.string()).optional(),
});

const basisEntrySchema = z.object({
  field: z.string().optional(),
  reasoning: z.string().optional(),
  citations: z.array(citationSchema).optional(),
  confidence: z.string().optional(),
});

const resultResponseSchema = z.object({
  run: z.object({
    run_id: z.string(),
    status: runStatusSchema,
    is_active: z.boolean().optional(),
  }),
  output: z
    .object({
      type: z.string(),
      content: z.unknown(),
      basis: z.array(basisEntrySchema).optional(),
    })
    .optional(),
});

export type ParallelRunStatus = z.infer<typeof runStatusSchema>;

export type ParallelResearchResult =
  | { status: "pending" }
  | { status: "failed" }
  | {
      status: "completed";
      content: unknown;
      citations: { url: string; title?: string }[];
    };

/**
 * Starts a Parallel deep-research task run and returns its run id. The run
 * proceeds asynchronously on Parallel's side; poll with
 * `fetchParallelResearchResult`.
 */
export async function startParallelResearch(args: {
  input: string;
  outputSchema: Record<string, unknown>;
  processor?: string;
  metadata?: Record<string, string>;
}): Promise<{ runId: string }> {
  const response = await fetch(`${PARALLEL_ORIGIN}/v1/tasks/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
    },
    body: JSON.stringify({
      processor: args.processor || DEFAULT_PROCESSOR,
      input: args.input,
      metadata: args.metadata,
      task_spec: {
        output_schema: {
          type: "json",
          json_schema: args.outputSchema,
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ParallelResearchError(
      "Parallel could not start the research run.",
      response.status,
    );
  }

  const parsed = createRunResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ParallelResearchError(
      "Parallel returned an unexpected run response.",
      502,
    );
  }
  return { runId: parsed.data.run_id };
}

/**
 * Fetches a research run's result. `timeoutSeconds` uses Parallel's blocking
 * behaviour; keep it well under the serverless limit and treat a timeout as
 * still pending.
 */
export async function fetchParallelResearchResult(
  runId: string,
  timeoutSeconds = 20,
): Promise<ParallelResearchResult> {
  let response: Response;
  try {
    response = await fetch(
      `${PARALLEL_ORIGIN}/v1/tasks/runs/${encodeURIComponent(runId)}/result?timeout=${timeoutSeconds}`,
      {
        headers: { "x-api-key": apiKey() },
        cache: "no-store",
        signal: AbortSignal.timeout((timeoutSeconds + 10) * 1000),
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /timeout|abort/i.test(`${error.name} ${error.message}`)
    ) {
      return { status: "pending" };
    }
    throw error;
  }

  // Parallel signals a still-running task with a timeout status.
  if (response.status === 408) return { status: "pending" };

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ParallelResearchError(
      "Parallel could not return the research result.",
      response.status,
    );
  }

  const parsed = resultResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ParallelResearchError(
      "Parallel returned an unexpected result response.",
      502,
    );
  }

  const { run, output } = parsed.data;
  if (run.status === "failed" || run.status === "cancelled") {
    return { status: "failed" };
  }
  if (run.status !== "completed" || !output) return { status: "pending" };

  const citations = (output.basis ?? [])
    .flatMap((entry) => entry.citations ?? [])
    .map((citation) => ({ url: citation.url, title: citation.title }))
    .filter(
      (citation, index, all) =>
        all.findIndex((other) => other.url === citation.url) === index,
    );

  return { status: "completed", content: output.content, citations };
}

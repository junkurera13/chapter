import "server-only";

import { z } from "zod";

const PARALLEL_ORIGIN = "https://api.parallel.ai";
const DEFAULT_PROCESSOR = process.env.CHAPTER_NOW_PROCESSOR || "core";

export class ParallelResearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly referenceId?: string,
  ) {
    super(message);
    this.name = "ParallelResearchError";
  }
}

function apiKey() {
  const key = process.env.PARALLEL_API_KEY;
  if (!key) {
    throw new ParallelResearchError("PARALLEL_API_KEY is not configured.", 500);
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

const providerErrorSchema = z.object({
  error: z
    .union([
      z.string(),
      z.object({
        ref_id: z.string().optional(),
        message: z.string().optional(),
      }),
    ])
    .optional(),
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

const PARALLEL_UNSUPPORTED_SCHEMA_KEYS = new Set([
  "$schema",
  "contains",
  "format",
  "maxContains",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minContains",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "pattern",
  "patternProperties",
  "propertyNames",
  "unevaluatedItems",
  "unevaluatedProperties",
  "uniqueItems",
]);

export function parallelCompatibleOutputSchema(
  value: unknown,
): Record<string, unknown> {
  function visit(current: unknown): unknown {
    if (Array.isArray(current)) return current.map(visit);
    if (!current || typeof current !== "object") return current;
    return Object.fromEntries(
      Object.entries(current)
        .filter(([key]) => !PARALLEL_UNSUPPORTED_SCHEMA_KEYS.has(key))
        .map(([key, child]) => [key, visit(child)]),
    );
  }

  const compatible = visit(value);
  if (
    !compatible ||
    typeof compatible !== "object" ||
    Array.isArray(compatible)
  ) {
    throw new ParallelResearchError(
      "Parallel research requires an object output schema.",
      500,
    );
  }
  return compatible as Record<string, unknown>;
}

function providerErrorFrom(payload: unknown) {
  const parsed = providerErrorSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.error) {
    return { message: "", referenceId: undefined };
  }
  if (typeof parsed.data.error === "string") {
    return {
      message: parsed.data.error.trim().slice(0, 300),
      referenceId: undefined,
    };
  }
  return {
    message: parsed.data.error.message?.trim().slice(0, 300) ?? "",
    referenceId: parsed.data.error.ref_id?.trim().slice(0, 120),
  };
}

function startFailureMessage(status: number, providerMessage: string) {
  if (status === 401) {
    return "Parallel rejected the configured API key.";
  }
  if (status === 402) {
    return "Parallel has insufficient account credit to start research. Add credit in Parallel Platform, then try again.";
  }
  if (status === 403) {
    return `Parallel rejected the configured research processor${providerMessage ? `: ${providerMessage}` : "."}`;
  }
  if (status === 422) {
    return `Parallel rejected the research request${providerMessage ? `: ${providerMessage}` : "."}`;
  }
  if (status === 429) {
    return "Parallel is temporarily rate-limited. Try again shortly.";
  }
  if (status >= 500) {
    return "Parallel is temporarily unavailable while starting research.";
  }
  return `Parallel could not start the research run (HTTP ${status})${providerMessage ? `: ${providerMessage}` : "."}`;
}

function retryDelayMs(response: Response) {
  const seconds = Number(response.headers.get("retry-after"));
  if (!Number.isFinite(seconds) || seconds < 0) return 750;
  return Math.min(seconds * 1_000, 5_000);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

let parallelResultReadTail: Promise<void> = Promise.resolve();

async function withParallelResultRead<T>(operation: () => Promise<T>) {
  const previous = parallelResultReadTail;
  let release!: () => void;
  parallelResultReadTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

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
  const processor = args.processor || DEFAULT_PROCESSOR;
  const body = JSON.stringify({
    processor,
    input: args.input,
    metadata: args.metadata,
    task_spec: {
      output_schema: {
        type: "json",
        json_schema: parallelCompatibleOutputSchema(args.outputSchema),
      },
    },
  });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${PARALLEL_ORIGIN}/v1/tasks/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey(),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new ParallelResearchError(
        error instanceof Error &&
          /timeout|abort/i.test(`${error.name} ${error.message}`)
          ? "Parallel did not respond while starting research."
          : "Parallel could not be reached while starting research.",
        504,
      );
    }

    const payload: unknown = await response.json().catch(() => ({}));
    if (response.ok) {
      const parsed = createRunResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ParallelResearchError(
          "Parallel returned an unexpected run response.",
          502,
        );
      }
      return { runId: parsed.data.run_id };
    }

    const providerError = providerErrorFrom(payload);
    console.error(
      [
        "[parallel:research] start rejected",
        `status=${response.status}`,
        `processor=${processor}`,
        `attempt=${attempt}`,
        `providerMessage=${JSON.stringify(providerError.message || "unknown")}`,
        `referenceId=${providerError.referenceId ?? "unknown"}`,
      ].join(" "),
    );
    if (response.status === 429 && attempt === 1) {
      await wait(retryDelayMs(response));
      continue;
    }
    throw new ParallelResearchError(
      startFailureMessage(response.status, providerError.message),
      response.status,
      providerError.referenceId,
    );
  }

  throw new ParallelResearchError(
    "Parallel is temporarily rate-limited. Try again shortly.",
    429,
  );
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
  return withParallelResultRead(async () => {
    // The short weekly-worker poll may receive a transient 408 even after the
    // result is available. Retry that bounded read once while holding the
    // provider-wide slot; longer blocking callers keep their single request.
    const attempts = timeoutSeconds <= 2 ? 2 : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
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

      // Parallel signals a still-running task with a timeout status. A short
      // poll gets one serialized retry so concurrent packs cannot keep one
      // another pending indefinitely through transient 408 responses.
      if (response.status === 408) {
        if (attempt < attempts) {
          await wait(150);
          continue;
        }
        return { status: "pending" };
      }

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

    return { status: "pending" };
  });
}

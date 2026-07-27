import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  generateText,
  Output,
  type UserContent,
} from "ai";

import {
  memoryExtractionSchema,
  type MemoryExtraction,
} from "./memoryExtractionSchema";

const PRIMARY_MEMORY_MODEL_ID =
  process.env.CHAPTER_MEMORY_MODEL || "google/gemini-3.1-flash-lite";
const FALLBACK_MEMORY_MODEL_ID =
  process.env.CHAPTER_MEMORY_FALLBACK_MODEL || "moonshotai/kimi-k2.6";
const ATTEMPT_TIMEOUTS_MS = [45_000, 35_000] as const;

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

type MemoryAttachment = {
  url: string;
  fileName: string;
  mediaType: string;
};

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function looksLikeTimeout(error: unknown) {
  return (
    /timeout|timed out|abort/i.test(errorName(error)) ||
    /timeout|timed out|abort/i.test(errorMessage(error))
  );
}

export class MemoryExtractionUnavailableError extends Error {
  constructor(readonly timedOut: boolean) {
    super(
      timedOut
        ? "Memory extraction reached its time limit."
        : "Memory extraction did not return a valid graph.",
    );
    this.name = "MemoryExtractionUnavailableError";
  }
}

export async function extractMemory(args: {
  prompt: string;
  attachments: MemoryAttachment[];
  requestId: string;
  signal?: AbortSignal;
}): Promise<MemoryExtraction> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const message: UserContent = [
    { type: "text", text: args.prompt },
    ...args.attachments.map((attachment) => ({
      type: "file" as const,
      data: new URL(attachment.url),
      mediaType: attachment.mediaType,
      filename: attachment.fileName,
    })),
  ];
  const modelIds = [PRIMARY_MEMORY_MODEL_ID, FALLBACK_MEMORY_MODEL_ID];
  let timedOut = false;

  for (const [attempt, modelId] of modelIds.entries()) {
    if (args.signal?.aborted) {
      throw new MemoryExtractionUnavailableError(true);
    }

    const startedAt = Date.now();
    console.info("[memory:extract] attempt started", {
      requestId: args.requestId,
      attempt: attempt + 1,
      model: modelId,
      imageCount: args.attachments.length,
    });

    try {
      const result = await generateText({
        model: openrouter(modelId),
        messages: [{ role: "user", content: message }],
        output: Output.object({
          name: "chapter_memory_graph",
          description:
            "A grounded memory graph with one experience node and separate specific people, places, activities, interests, feelings, conditions, and patterns.",
          schema: memoryExtractionSchema,
        }),
        reasoning: "none",
        temperature: 0.1,
        maxOutputTokens: 5_500,
        maxRetries: 0,
        timeout: { totalMs: ATTEMPT_TIMEOUTS_MS[attempt] },
        abortSignal: args.signal,
      });
      const extraction = memoryExtractionSchema.parse(result.output);
      console.info("[memory:extract] attempt completed", {
        requestId: args.requestId,
        attempt: attempt + 1,
        model: modelId,
        elapsedMs: Date.now() - startedAt,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
      return extraction;
    } catch (error) {
      timedOut ||= looksLikeTimeout(error);
      console.warn("[memory:extract] attempt failed", {
        requestId: args.requestId,
        attempt: attempt + 1,
        model: modelId,
        elapsedMs: Date.now() - startedAt,
        errorName: errorName(error),
      });
    }
  }

  throw new MemoryExtractionUnavailableError(timedOut);
}

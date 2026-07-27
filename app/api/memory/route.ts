import { Base44FunctionError, fetchMySession } from "@/lib/base44Functions";
import { MemoryExtractionUnavailableError } from "@/lib/memoryExtractor";
import { extractAndPersistMemory } from "@/lib/sidequestAgent";
import { SidequestBackendError } from "@/lib/sidequestAgentBackend";

export const runtime = "nodejs";
export const maxDuration = 120;

type MemoryRequestBody = {
  clientRequestId?: unknown;
  source?: unknown;
  text?: unknown;
  images?: unknown;
};

function requestBody(value: unknown): value is MemoryRequestBody {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const requestId = crypto.randomUUID();
  console.info("[memory:route] request started", { requestId });
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    return Response.json(
      {
        error: "Your session expired. Sign in again, then start once more.",
        code: "AUTHENTICATION_REQUIRED",
      },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON.", code: "MEMORY_INPUT_INVALID" },
      { status: 400 },
    );
  }
  if (!requestBody(body)) {
    return Response.json(
      { error: "Invalid memory request.", code: "MEMORY_INPUT_INVALID" },
      { status: 400 },
    );
  }
  try {
    const session = await fetchMySession(accessToken);
    const value = await extractAndPersistMemory({
      authUserId: session.viewer.id,
      phone: session.viewer.phone,
      clientRequestId:
        typeof body.clientRequestId === "string" ? body.clientRequestId : "",
      source: body.source === "reflection" ? "reflection" : "onboarding",
      text: typeof body.text === "string" ? body.text : "",
      images: Array.isArray(body.images)
        ? (body.images as Array<{
            fileUri: string;
            fileName: string;
            mediaType: string;
            byteSize: number;
            context: string;
          }>)
        : [],
      accessToken,
      origin: new URL(request.url).origin,
      signal: request.signal,
    });
    console.info("[memory:route] request completed", {
      requestId,
      memoryId: value.memoryId,
      elapsedMs: Date.now() - requestStartedAt,
    });
    return Response.json({ value });
  } catch (error) {
    console.error("[memory:route] request failed", {
      requestId,
      elapsedMs: Date.now() - requestStartedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof MemoryExtractionUnavailableError) {
      return Response.json(
        {
          error: error.timedOut
            ? "Chapter took too long to read that memory."
            : "Chapter couldn’t extract a reliable memory graph.",
          code: error.timedOut ? "MEMORY_TIMEOUT" : "MEMORY_PROCESSING_FAILED",
        },
        { status: error.timedOut ? 504 : 502 },
      );
    }
    if (error instanceof SidequestBackendError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof Base44FunctionError) {
      return Response.json(
        {
          error: error.message,
          code:
            error.status === 401
              ? "AUTHENTICATION_REQUIRED"
              : "MEMORY_PROCESSING_FAILED",
        },
        { status: error.status === 401 ? 401 : 502 },
      );
    }
    return Response.json(
      {
        error: "Chapter couldn’t finish that memory just now.",
        code: "MEMORY_PROCESSING_FAILED",
      },
      { status: 502 },
    );
  }
}

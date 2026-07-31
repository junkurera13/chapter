import {
  adventureLabRequestSchema,
} from "@/lib/adventureLab";
import {
  AdventureLabGenerationError,
  craftAdventureLabExperience,
} from "@/lib/adventureLabGeneration";
import {
  Base44FunctionError,
  fetchMyGraph,
  fetchMyNow,
} from "@/lib/base44Functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function accessTokenFrom(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function failure(error: unknown, requestId: string) {
  console.error("[adventure-lab] generation failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : String(error),
  });
  if (error instanceof Base44FunctionError) {
    return Response.json(
      {
        error:
          error.status === 401
            ? "Your session expired. Open Chapter and sign in again."
            : "Chapter couldn’t open your world just now.",
        code:
          error.status === 401
            ? "AUTHENTICATION_REQUIRED"
            : "ADVENTURE_LAB_BACKEND_FAILED",
      },
      { status: error.status === 401 ? 401 : 502 },
    );
  }
  if (error instanceof AdventureLabGenerationError) {
    return Response.json(
      {
        error:
          error.kind === "provider"
            ? "Chapter’s model couldn’t finish that adventure. Try again."
            : error.kind === "research"
              ? "Chapter couldn’t prove a real place for that adventure. Try another."
              : "That adventure broke the Chapter equation, so it was rejected. Try again.",
        code:
          error.kind === "provider"
            ? "ADVENTURE_LAB_MODEL_FAILED"
            : error.kind === "research"
              ? "ADVENTURE_LAB_RESEARCH_FAILED"
              : "ADVENTURE_LAB_QUALITY_FAILED",
      },
      { status: 502 },
    );
  }
  return Response.json(
    {
      error: "Chapter couldn’t craft those adventures just now.",
      code: "ADVENTURE_LAB_FAILED",
    },
    { status: 502 },
  );
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const requestId = crypto.randomUUID();
  const accessToken = accessTokenFrom(request);
  if (!accessToken) {
    return Response.json(
      {
        error: "Open Chapter and sign in first.",
        code: "AUTHENTICATION_REQUIRED",
      },
      { status: 401 },
    );
  }

  const payload = adventureLabRequestSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!payload.success) {
    return Response.json(
      {
        error: "The feedback attached to this request wasn’t valid.",
        code: "ADVENTURE_LAB_INVALID_REQUEST",
      },
      { status: 400 },
    );
  }

  try {
    const [graph, now] = await Promise.all([
      fetchMyGraph(accessToken),
      fetchMyNow(accessToken),
    ]);
    if (!now.homeCity) {
      return Response.json(
        {
          error: "Tell Chapter your home city before using the lab.",
          code: "HOME_CITY_REQUIRED",
        },
        { status: 409 },
      );
    }
    const hasUsableAnchor = graph.nodes.some(
      (node) =>
        node.category === "place" ||
        node.category === "activity" ||
        node.category === "interest",
    );
    if (!hasUsableAnchor) {
      return Response.json(
        {
          error:
            "Add one memory about a place, activity, or interest before using the lab.",
          code: "ADVENTURE_LAB_MEMORY_REQUIRED",
        },
        { status: 409 },
      );
    }

    const crafted = await craftAdventureLabExperience({
      graph,
      homeCity: now.homeCity,
      feedback: payload.data.feedback,
      requestId,
    });

    return Response.json({ value: crafted.batch });
  } catch (error) {
    return failure(error, requestId);
  }
}

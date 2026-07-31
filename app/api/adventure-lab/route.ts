import {
  adventureLabBatchFrom,
  adventureLabRequestSchema,
  buildAdventureLabGenerationNotes,
} from "@/lib/adventureLab";
import {
  Base44FunctionError,
  fetchMyGraph,
  fetchMyNow,
} from "@/lib/base44Functions";
import { seededChapterRandom } from "@/lib/chapterEquation";
import {
  chooseWeeklyPackShapeContracts,
  type WeeklyPackContext,
} from "@/lib/weeklyPackDesign";
import {
  designWeeklyPack,
  WeeklyPackGenerationError,
} from "@/lib/weeklyPackGeneration";

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
  if (error instanceof WeeklyPackGenerationError) {
    return Response.json(
      {
        error:
          "Those ideas didn’t pass Chapter’s quality check. Try another set.",
        code: "ADVENTURE_LAB_QUALITY_FAILED",
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

    const random = seededChapterRandom(requestId);
    const context: WeeklyPackContext = {
      homeCity: now.homeCity,
      privacyMode: "personal",
      availableCompanies: ["self"],
      shapeContracts: chooseWeeklyPackShapeContracts({
        graph,
        random,
      }),
      maxMechanismOccurrences: { taste: 1 },
      generationNotes: [
        "Make the three choices genuinely different in action, rhythm, and commitment.",
        ...buildAdventureLabGenerationNotes(payload.data.feedback),
      ],
    };
    const designed = await designWeeklyPack({
      source: { graph, context },
      requestId,
    });
    const batch = adventureLabBatchFrom(requestId, designed.pack);

    return Response.json({ value: batch });
  } catch (error) {
    return failure(error, requestId);
  }
}

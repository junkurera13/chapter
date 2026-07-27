import {
  Base44FunctionError,
  createNowChapter,
  fetchMyGraph,
  fetchMyNow,
  setMyHomeCity,
  updateNowChapter,
} from "@/lib/base44Functions";
import { NOW_RESEARCH_OUTPUT_SCHEMA } from "@/lib/nowChapterSchema";
import {
  composeNowChapter,
  generateNowBrief,
  NowGenerationError,
} from "@/lib/nowGeneration";
import {
  fetchParallelResearchResult,
  ParallelResearchError,
  startParallelResearch,
} from "@/lib/parallelResearch";

export const runtime = "nodejs";
export const maxDuration = 120;

function accessTokenFrom(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function unauthenticated() {
  return Response.json(
    {
      error: "Your session expired. Sign in again.",
      code: "AUTHENTICATION_REQUIRED",
    },
    { status: 401 },
  );
}

function failure(error: unknown, requestId: string) {
  console.error("[now:route] request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  if (error instanceof Base44FunctionError) {
    return Response.json(
      { error: error.message, code: "NOW_BACKEND_FAILED" },
      { status: error.status === 401 ? 401 : 502 },
    );
  }
  if (
    error instanceof NowGenerationError ||
    error instanceof ParallelResearchError
  ) {
    return Response.json(
      { error: error.message, code: "NOW_GENERATION_FAILED" },
      { status: 502 },
    );
  }
  return Response.json(
    { error: "Chapter couldn’t finish that just now.", code: "NOW_FAILED" },
    { status: 502 },
  );
}

/**
 * Returns the current Now state. When a research run is in flight it also
 * advances it: a completed Parallel run is composed into the proposal here,
 * so the client only ever polls this one endpoint.
 */
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  try {
    const now = await fetchMyNow(accessToken);
    const chapter = now.chapter;
    if (
      !chapter ||
      chapter.status !== "researching" ||
      !chapter.researchRunId ||
      !chapter.brief
    ) {
      return Response.json({ value: now });
    }

    const result = await fetchParallelResearchResult(chapter.researchRunId, 15);
    if (result.status === "pending") {
      return Response.json({ value: now });
    }

    if (result.status === "failed") {
      const failed = await updateNowChapter(
        { chapterId: chapter.id, status: "failed" },
        accessToken,
      );
      return Response.json({ value: { ...now, chapter: failed.chapter } });
    }

    try {
      const composed = await composeNowChapter({
        brief: chapter.brief,
        researchContent: result.content,
        citations: result.citations,
        homeCity: now.homeCity,
        requestId,
        signal: request.signal,
      });
      const proposed = await updateNowChapter(
        {
          chapterId: chapter.id,
          status: "proposed",
          contentJson: JSON.stringify(composed.content),
          evidenceJson: JSON.stringify(composed.evidence),
          venueName: composed.content.venueName,
        },
        accessToken,
      );
      console.info("[now:route] proposal composed", {
        requestId,
        chapterId: chapter.id,
      });
      return Response.json({ value: { ...now, chapter: proposed.chapter } });
    } catch (error) {
      console.error("[now:route] composition failed", {
        requestId,
        chapterId: chapter.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      const failed = await updateNowChapter(
        { chapterId: chapter.id, status: "failed" },
        accessToken,
      );
      return Response.json({ value: { ...now, chapter: failed.chapter } });
    }
  } catch (error) {
    return failure(error, requestId);
  }
}

type NowActionBody = {
  action?: unknown;
  homeCity?: unknown;
  scheduledFor?: unknown;
  reason?: unknown;
  chapterId?: unknown;
};

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  let body: NowActionBody;
  try {
    body = (await request.json()) as NowActionBody;
  } catch {
    return Response.json(
      { error: "Invalid request.", code: "NOW_INPUT_INVALID" },
      { status: 400 },
    );
  }

  try {
    if (body.action === "setHomeCity") {
      const homeCity =
        typeof body.homeCity === "string" ? body.homeCity.trim() : "";
      if (homeCity.length < 2) {
        return Response.json(
          { error: "Tell Chapter a city first.", code: "NOW_INPUT_INVALID" },
          { status: 400 },
        );
      }
      const value = await setMyHomeCity(homeCity, accessToken);
      return Response.json({ value });
    }

    if (body.action === "start") {
      const now = await fetchMyNow(accessToken);
      if (!now.homeCity) {
        return Response.json(
          { error: "Chapter needs your city first.", code: "NOW_NEEDS_CITY" },
          { status: 409 },
        );
      }
      if (
        now.chapter &&
        ["researching", "proposed", "accepted"].includes(now.chapter.status)
      ) {
        return Response.json(
          { error: "One chapter at a time.", code: "NOW_CHAPTER_ACTIVE" },
          { status: 409 },
        );
      }

      const graph = await fetchMyGraph(accessToken);
      if (graph.memoryCount === 0) {
        return Response.json(
          { error: "Share a memory first.", code: "NOW_NEEDS_MEMORY" },
          { status: 409 },
        );
      }

      console.info("[now:route] generation started", { requestId });
      const brief = await generateNowBrief({
        graph,
        homeCity: now.homeCity,
        avoidVenues: now.avoidVenues,
        declineReason:
          now.chapter?.status === "declined"
            ? now.chapter.declineReason
            : undefined,
        requestId,
        signal: request.signal,
      });

      const { runId } = await startParallelResearch({
        input: brief.researchObjective,
        outputSchema: NOW_RESEARCH_OUTPUT_SCHEMA as unknown as Record<
          string,
          unknown
        >,
        metadata: { app: "chapter", surface: "now" },
      });

      const created = await createNowChapter(
        { researchRunId: runId, briefJson: JSON.stringify(brief) },
        accessToken,
      );
      console.info("[now:route] research run created", {
        requestId,
        chapterId: created.chapter.id,
      });
      return Response.json({ value: { chapter: created.chapter } });
    }

    if (
      body.action === "accept" ||
      body.action === "decline" ||
      body.action === "lived"
    ) {
      const chapterId =
        typeof body.chapterId === "string" ? body.chapterId : "";
      if (!chapterId) {
        return Response.json(
          { error: "Missing chapter.", code: "NOW_INPUT_INVALID" },
          { status: 400 },
        );
      }

      if (body.action === "accept") {
        const scheduledFor =
          typeof body.scheduledFor === "string" ? body.scheduledFor : "";
        const value = await updateNowChapter(
          { chapterId, status: "accepted", scheduledFor },
          accessToken,
        );
        return Response.json({ value });
      }
      if (body.action === "decline") {
        const value = await updateNowChapter(
          {
            chapterId,
            status: "declined",
            declineReason:
              typeof body.reason === "string" ? body.reason.slice(0, 300) : "",
          },
          accessToken,
        );
        return Response.json({ value });
      }
      const value = await updateNowChapter(
        { chapterId, status: "lived" },
        accessToken,
      );
      return Response.json({ value });
    }

    return Response.json(
      { error: "Unknown action.", code: "NOW_INPUT_INVALID" },
      { status: 400 },
    );
  } catch (error) {
    return failure(error, requestId);
  }
}

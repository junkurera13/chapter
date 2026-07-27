import {
  Base44FunctionError,
  createNowChapter,
  fetchMyGraph,
  fetchMyNow,
  setMyHomeCity,
  setMyNowPreferences,
  updateNowChapter,
} from "@/lib/base44Functions";
import {
  NOW_DEFAULT_REACH,
  NOW_DEFAULT_WINDOW,
  NOW_REACHES,
  NOW_RESEARCH_OUTPUT_SCHEMA,
  NOW_TIME_WINDOWS,
  type NowChapterRecord,
  type NowReach,
  type NowTimeWindow,
} from "@/lib/nowChapterSchema";
import {
  composeNowChapter,
  generateNowBrief,
  NowGenerationError,
} from "@/lib/nowGeneration";
import {
  canSchedule,
  comingWeekend,
  daysBetween,
  isIsoDay,
  isoDay,
} from "@/lib/nowSchedule";
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

/**
 * The caller's own calendar day, which is the only one a plan means anything
 * in: a Saturday in Seoul is not this server's Saturday. Clamped to a day
 * either side of the server's, so the worst a bad value can do is let through
 * a day the person could have picked anyway.
 */
function viewerToday(value: unknown) {
  const claimed = typeof value === "string" ? value : "";
  const serverToday = isoDay();
  if (!isIsoDay(claimed)) return serverToday;
  return Math.abs(daysBetween(serverToday, claimed)) <= 1 ? claimed : serverToday;
}

type NowSnapshot = Awaited<ReturnType<typeof fetchMyNow>>;

/**
 * Stages one and two of a chapter: read the world, write the one-stretch
 * brief, hand it to deep research, and record the run against the person.
 *
 * This is the only path that spends money, and the only thing that reaches it
 * is a person pressing the orb.
 *
 * It researches against the caller's next free day rather than against no day
 * at all: research with nothing to check opening hours against comes home with
 * hours nobody can plan around. That day is a frame for the search, not a
 * booking. What gets booked is whatever they pick after reading the thing.
 */
async function beginWriting(args: {
  now: NowSnapshot;
  graph: Awaited<ReturnType<typeof fetchMyGraph>>;
  accessToken: string;
  requestId: string;
  /** The day to research against when none has been set aside. */
  horizon?: string;
  signal?: AbortSignal;
}): Promise<NowChapterRecord> {
  const { now, requestId } = args;
  const scheduled = now.chapter?.status === "scheduled" ? now.chapter : null;

  /*
   * The hours and the reach are read off the account rather than taken from
   * whoever called this. They are what the person saved, so there is no second
   * copy that could disagree with it, and no way for a stale tab to research
   * against something they have already changed their mind about.
   */
  const scheduledFor = scheduled?.scheduledFor ?? args.horizon;
  const timeWindows = scheduled?.timeWindows?.length
    ? scheduled.timeWindows
    : now.timeWindows?.length
      ? now.timeWindows
      : [NOW_DEFAULT_WINDOW];
  const reach = scheduled?.reach ?? now.reach ?? NOW_DEFAULT_REACH;

  const brief = await generateNowBrief({
    graph: args.graph,
    homeCity: now.homeCity,
    avoidVenues: now.avoidVenues,
    declineReason:
      now.chapter?.status === "declined" ? now.chapter.declineReason : undefined,
    scheduledFor,
    timeWindows,
    reach,
    requestId,
    signal: args.signal,
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
    args.accessToken,
  );
  console.info("[now:route] research run created", {
    requestId,
    chapterId: created.chapter.id,
    scheduled: Boolean(scheduled),
  });
  return created.chapter;
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
 * Returns the current Now state, and composes a finished research run into a
 * proposal on the way past.
 *
 * Reading never starts a run. Writing a chapter costs real money, and the only
 * thing that spends it is somebody pressing the orb.
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
        scheduledFor: chapter.scheduledFor,
        timeWindows: chapter.timeWindows,
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
  timeWindows?: unknown;
  reach?: unknown;
  today?: unknown;
  reason?: unknown;
  chapterId?: unknown;
};

function chosenWindows(value: unknown): NowTimeWindow[] {
  const chosen = Array.isArray(value) ? value : [];
  return NOW_TIME_WINDOWS.filter((window) => chosen.includes(window));
}

function chosenReach(value: unknown): NowReach | null {
  return NOW_REACHES.find((reach) => reach === value) ?? null;
}

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

    /*
     * The two standing habits, saved against the account so they follow a
     * person to whatever they next open Chapter on.
     */
    if (body.action === "setPreferences") {
      const timeWindows = chosenWindows(body.timeWindows);
      const reach = chosenReach(body.reach);
      if (timeWindows.length === 0 || !reach) {
        return Response.json(
          {
            error: "Tell Chapter when you’re free.",
            code: "NOW_INPUT_INVALID",
          },
          { status: 400 },
        );
      }
      const value = await setMyNowPreferences({ timeWindows, reach }, accessToken);
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
      // Asking now for a day already set aside writes for that day, rather
      // than starting a second chapter beside it. Asking with nothing set
      // aside researches against the coming weekend, which is what the button
      // that sent this offered to write for.
      const chapter = await beginWriting({
        now,
        graph,
        accessToken,
        requestId,
        horizon: comingWeekend(viewerToday(body.today)),
        signal: request.signal,
      });
      return Response.json({ value: { chapter } });
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
        // The one day this product still takes, so it is the one worth
        // checking: saying you are going on a day already gone is not a plan.
        if (!canSchedule(scheduledFor, viewerToday(body.today))) {
          return Response.json(
            {
              error: "Pick a day that hasn’t gone yet.",
              code: "NOW_INPUT_INVALID",
            },
            { status: 400 },
          );
        }
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

import { runWeeklyPackCycle } from "@/lib/weeklyPackWorker";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function configuredInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0
    ? Math.min(parsed, maximum)
    : fallback;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "Weekly pack scheduling is not configured." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const requestId = crypto.randomUUID();
  try {
    const summary = await runWeeklyPackCycle({
      maxNewPacks: configuredInteger(
        process.env.CHAPTER_WEEKLY_PACKS_PER_RUN,
        2,
        10,
      ),
      candidateLimit: configuredInteger(
        process.env.CHAPTER_WEEKLY_PACK_CANDIDATE_LIMIT,
        50,
        100,
      ),
      preparationLimit: configuredInteger(
        process.env.CHAPTER_WEEKLY_PACK_POLL_LIMIT,
        12,
        50,
      ),
    });
    console.info("[weekly-pack:cron] cycle completed", {
      requestId,
      ...summary,
    });
    return Response.json({ ok: true, requestId, summary });
  } catch (error) {
    console.error("[weekly-pack:cron] cycle failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        ok: false,
        requestId,
        error: "The weekly pack cycle could not finish.",
      },
      { status: 502 },
    );
  }
}

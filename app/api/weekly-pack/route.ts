import {
  Base44FunctionError,
  claimMyWeeklyPackCreatorPreparation,
  failWeeklyPackPreparation,
  fetchMyNow,
  fetchMySession,
  fetchMyWeeklyPack,
  fetchMyWeeklyPackCreatorPreparation,
  updateMyWeeklyPack,
} from "@/lib/base44Functions";
import { canCreateWeeklyPacks } from "@/base44/shared/weekly-pack-creator";
import {
  WEEKLY_PACK_SCALES,
  type WeeklyPackScale,
} from "@/lib/weeklyPackDesign";
import { weeklyExperiencePackSchema } from "@/lib/weeklyPackSchema";
import { weeklyPackWindow } from "@/lib/weeklyPackSchedule";
import {
  advanceWeeklyPackPreparation,
  startClaimedWeeklyPack,
} from "@/lib/weeklyPackWorker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

function creatorNotFound() {
  return Response.json({ error: "Not found." }, { status: 404 });
}

async function creatorSession(accessToken: string) {
  const session = await fetchMySession(accessToken);
  return canCreateWeeklyPacks(session.viewer.email) ? session : null;
}

async function publicPackValue(timezone: string, accessToken: string) {
  const value = await fetchMyWeeklyPack(timezone, accessToken);
  return {
    pack: value.pack ? weeklyExperiencePackSchema.parse(value.pack) : null,
    generationStatus: value.preparing ? "preparing" as const : "idle" as const,
  };
}

function errorDetail(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  return `${error.name}: ${error.message}`.replace(/\s+/g, " ").slice(0, 500);
}

function failure(error: unknown) {
  console.error("[weekly-pack:route] request failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: errorDetail(error),
  });
  if (error instanceof Base44FunctionError) {
    return Response.json(
      { error: error.message, code: "WEEKLY_PACK_BACKEND_FAILED" },
      { status: error.status === 401 ? 401 : error.status === 409 ? 409 : 502 },
    );
  }
  return Response.json(
    {
      error: "Chapter couldn’t open this week’s pack just now.",
      code: "WEEKLY_PACK_FAILED",
    },
    { status: 502 },
  );
}

export async function GET(request: Request) {
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  try {
    const timezone =
      new URL(request.url).searchParams.get("timezone")?.slice(0, 80) || "UTC";
    const value = await fetchMyWeeklyPack(timezone, accessToken);
    // Keep local source usable while the corresponding Base44 function update
    // is awaiting deployment. The fallback reads account data only; it never
    // starts experience generation.
    const homeCity =
      typeof value.homeCity === "string"
        ? value.homeCity
        : (await fetchMyNow(accessToken)).homeCity;
    return Response.json({
      value: {
        ...value,
        homeCity,
        preparing: value.preparing === true,
        pack: value.pack
          ? weeklyExperiencePackSchema.parse(value.pack)
          : null,
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "create") {
      if (!await creatorSession(accessToken)) return creatorNotFound();

      const timezone =
        typeof body.timezone === "string" ? body.timezone.slice(0, 80) : "UTC";
      const requestId = crypto.randomUUID();
      const now = Date.now();
      const window = weeklyPackWindow({ timezone, now });
      const claim = await claimMyWeeklyPackCreatorPreparation(
        {
          weekKey: window.weekKey,
          timezone,
          releaseAt: now - 1_000,
          expiresAt: window.expiresAt,
          generationRequestId: requestId,
        },
        accessToken,
      );
      if (!claim.claimed) {
        return Response.json({
          value: {
            pack: null,
            generationStatus: "preparing",
          },
        });
      }
      if (!claim.source) {
        throw new Error("Base44 returned an incomplete creator claim.");
      }

      try {
        await startClaimedWeeklyPack({
          source: claim.source,
          preparation: claim.preparation,
          requestId,
          weekKey: window.weekKey,
        });
      } catch (error) {
        const current = await publicPackValue(timezone, accessToken).catch(
          () => null,
        );
        if (
          current?.generationStatus === "idle" &&
          current.pack &&
          current.pack.status !== "failed"
        ) {
          return Response.json({ value: current });
        }
        await failWeeklyPackPreparation({
          packId: claim.preparation.id,
          error: `creator start failed: ${errorDetail(error)}`,
        }).catch(() => undefined);
        throw error;
      }

      return Response.json({
        value: await publicPackValue(timezone, accessToken),
      });
    }

    if (action === "advance") {
      if (!await creatorSession(accessToken)) return creatorNotFound();
      const timezone =
        typeof body.timezone === "string" ? body.timezone.slice(0, 80) : "UTC";
      const { preparation } =
        await fetchMyWeeklyPackCreatorPreparation(accessToken);
      if (preparation && (!preparation.design || !preparation.researchRuns)) {
        if (Date.now() - preparation.updatedAt > 10 * 60 * 1_000) {
          await failWeeklyPackPreparation({
            packId: preparation.id,
            error: "creator start did not finish",
          }).catch(() => undefined);
        }
        return Response.json({
          value: await publicPackValue(timezone, accessToken),
        });
      }
      if (!preparation) {
        return Response.json({
          value: await publicPackValue(timezone, accessToken),
        });
      }

      try {
        const result = await advanceWeeklyPackPreparation(preparation);
        if (result.status === "ready") {
          return Response.json({
            value: {
              pack: weeklyExperiencePackSchema.parse(result.pack),
              generationStatus: "idle",
            },
          });
        }
      } catch (error) {
        const current = await publicPackValue(timezone, accessToken).catch(
          () => null,
        );
        if (
          current?.generationStatus === "idle" &&
          current.pack &&
          current.pack.status !== "failed"
        ) {
          return Response.json({ value: current });
        }
        await failWeeklyPackPreparation({
          packId: preparation.id,
          error: `creator advance failed: ${errorDetail(error)}`,
        }).catch(() => undefined);
        throw error;
      }
      return Response.json({
        value: await publicPackValue(timezone, accessToken),
      });
    }

    const packId = typeof body.packId === "string" ? body.packId : "";
    if (!packId) {
      return Response.json(
        { error: "Pack required.", code: "INVALID_WEEKLY_PACK_ACTION" },
        { status: 400 },
      );
    }

    let result;
    if (action === "reveal" || action === "choose") {
      const cardId =
        typeof body.cardId === "string" &&
        (WEEKLY_PACK_SCALES as readonly string[]).includes(body.cardId)
          ? (body.cardId as WeeklyPackScale)
          : undefined;
      if (!cardId) {
        return Response.json(
          { error: "Card required.", code: "INVALID_WEEKLY_PACK_ACTION" },
          { status: 400 },
        );
      }
      result = await updateMyWeeklyPack(
        { packId, transition: action, cardId },
        accessToken,
      );
    } else if (action === "schedule") {
      const scheduledFor =
        typeof body.scheduledFor === "string" ? body.scheduledFor : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
        return Response.json(
          { error: "Date required.", code: "INVALID_WEEKLY_PACK_ACTION" },
          { status: 400 },
        );
      }
      result = await updateMyWeeklyPack(
        { packId, transition: "schedule", scheduledFor },
        accessToken,
      );
    } else if (action === "dismiss" || action === "lived") {
      result = await updateMyWeeklyPack(
        { packId, transition: action },
        accessToken,
      );
    } else {
      return Response.json(
        { error: "Unknown action.", code: "INVALID_WEEKLY_PACK_ACTION" },
        { status: 400 },
      );
    }

    return Response.json({
      value: { pack: weeklyExperiencePackSchema.parse(result.pack) },
    });
  } catch (error) {
    return failure(error);
  }
}

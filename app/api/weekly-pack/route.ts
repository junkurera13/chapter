import {
  Base44FunctionError,
  fetchMyWeeklyPack,
  updateMyWeeklyPack,
} from "@/lib/base44Functions";
import {
  WEEKLY_PACK_SCALES,
  type WeeklyPackScale,
} from "@/lib/weeklyPackDesign";
import { weeklyExperiencePackSchema } from "@/lib/weeklyPackSchema";

export const runtime = "nodejs";

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

function failure(error: unknown) {
  console.error("[weekly-pack:route] request failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
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
    return Response.json({
      value: {
        ...value,
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
    const packId = typeof body.packId === "string" ? body.packId : "";
    const action = typeof body.action === "string" ? body.action : "";
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


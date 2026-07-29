import { z } from "zod";

import {
  fetchMyGraph,
  fetchMyNow,
  fetchMySession,
} from "@/lib/base44Functions";
import {
  composeWeeklyExperienceCards,
  designWeeklyPack,
  pollWeeklyPackResearch,
  startWeeklyPackResearch,
} from "@/lib/weeklyPackGeneration";
import {
  openWeeklyPackReviewJob,
  sealWeeklyPackReviewJob,
  weeklyPackAccessTokenHash,
} from "@/lib/weeklyPackGeneratorReview";
import { weeklyPackWindow } from "@/lib/weeklyPackSchedule";
import { weeklyExperiencePackSchema } from "@/lib/weeklyPackSchema";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("authorize"),
  }),
  z.object({
    action: z.literal("start"),
    timezone: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("poll"),
    jobToken: z.string().min(1),
  }),
  z.object({
    action: z.literal("finish"),
    jobToken: z.string().min(1),
  }),
]);

function accessTokenFrom(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function reviewSecret() {
  const secret = process.env.SIDEQUEST_INTERNAL_SECRET?.trim();
  if (!secret) {
    throw new Error("The experience generator is not configured.");
  }
  return secret;
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

function failure(error: unknown, requestId: string) {
  console.error(
    [
      "[experience-generator] request failed",
      `requestId=${requestId}`,
      `error=${error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError"}`,
    ].join(" "),
  );
  const message =
    error instanceof Error
      ? error.message
      : "Chapter couldn’t generate those experiences.";
  return Response.json(
    {
      error: message,
      code: "EXPERIENCE_GENERATION_FAILED",
    },
    { status: 502 },
  );
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
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

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "That generator request is invalid.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  try {
    if (input.action === "authorize" || input.action === "start") {
      await fetchMySession(accessToken);
      if (input.action === "authorize") {
        return Response.json({ value: { status: "authorized" } });
      }

      const [graph, nowContext] = await Promise.all([
        fetchMyGraph(accessToken),
        fetchMyNow(accessToken),
      ]);
      if (graph.memoryCount === 0 || graph.nodes.length === 0) {
        return Response.json(
          {
            error: "Add a little more to your world before generating a pack.",
            code: "GRAPH_NOT_READY",
          },
          { status: 409 },
        );
      }

      const timezone = validTimezone(input.timezone);
      const context = {
        homeCity: nowContext.homeCity,
        privacyMode: "personal" as const,
        availableCompanies: ["self"] as const,
        maxMechanismOccurrences: { taste: 1 },
        generationNotes: [
          "Make the three choices feel genuinely different in action, rhythm, and commitment.",
          "This reviewer run has no server-confirmed social candidate. Keep all three cards solo.",
        ],
      };
      const generationRequestId = crypto.randomUUID();
      const designed = await designWeeklyPack({
        source: { graph, context },
        requestId: generationRequestId,
      });
      const { weekKey } = weeklyPackWindow({ timezone });
      const runs = await startWeeklyPackResearch({
        pack: designed.pack,
        context,
        weekKey,
      });
      const jobToken = sealWeeklyPackReviewJob(
        {
          version: 1,
          accessTokenHash: weeklyPackAccessTokenHash(accessToken),
          requestId: generationRequestId,
          createdAt: Date.now(),
          weekKey,
          artifact: {
            ...designed,
            homeCity: context.homeCity,
          },
          runs,
        },
        reviewSecret(),
      );

      return Response.json({
        value: { status: "researching", jobToken },
      });
    }

    const job = openWeeklyPackReviewJob({
      token: input.jobToken,
      secret: reviewSecret(),
    });
    if (
      job.accessTokenHash !== weeklyPackAccessTokenHash(accessToken)
    ) {
      return Response.json(
        {
          error: "That generator session belongs to another sign-in.",
          code: "GENERATOR_SESSION_MISMATCH",
        },
        { status: 403 },
      );
    }

    if (input.action === "poll") {
      if (job.research) {
        return Response.json({
          value: { status: "ready-to-compose", jobToken: input.jobToken },
        });
      }
      const research = await pollWeeklyPackResearch({
        pack: job.artifact.pack,
        runs: job.runs,
        homeCity: job.artifact.homeCity,
        requestId: job.requestId,
      });
      if (research.status === "pending") {
        return Response.json({
          value: { status: "researching", jobToken: input.jobToken },
        });
      }
      const jobToken = sealWeeklyPackReviewJob(
        { ...job, research: research.results },
        reviewSecret(),
      );
      return Response.json({
        value: { status: "ready-to-compose", jobToken },
      });
    }

    if (!job.research) {
      return Response.json(
        {
          error: "The research is still running.",
          code: "RESEARCH_PENDING",
        },
        { status: 409 },
      );
    }
    const cards = await composeWeeklyExperienceCards({
      pack: job.artifact.pack,
      research: job.research,
      requestId: job.requestId,
      companion: job.artifact.companion,
    });
    const pack = weeklyExperiencePackSchema.parse({
      id: `review-${job.requestId}`,
      weekKey: job.weekKey,
      status: "available",
      releaseAt: job.createdAt,
      expiresAt: job.createdAt + 21 * 24 * 60 * 60 * 1_000,
      cards,
      revealedCardIds: [],
    });

    return Response.json({ value: { status: "ready", pack } });
  } catch (error) {
    return failure(error, requestId);
  }
}

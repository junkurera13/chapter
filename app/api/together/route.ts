import {
  Base44FunctionError,
  createTogetherChapter,
  fetchMyGraph,
  fetchMyTogether,
  fetchPartnerPlanningGraph,
  fetchTogetherNotifyTarget,
  updateTogetherChapter,
} from "@/lib/base44Functions";
import { withBackendDetail } from "@/lib/backendFailureDetail";
import { NOW_RESEARCH_OUTPUT_SCHEMA } from "@/lib/nowChapterSchema";
import { NowGenerationError } from "@/lib/nowGeneration";
import {
  fetchParallelResearchResult,
  ParallelResearchError,
  startParallelResearch,
} from "@/lib/parallelResearch";
import type { TogetherChapterRecord } from "@/lib/togetherChapterSchema";
import {
  composeTogetherChapter,
  generateTogetherBrief,
  planningGraphFrom,
  TogetherGenerationError,
} from "@/lib/togetherGeneration";
import {
  answerPingText,
  proposalPingText,
  sendTogetherPing,
} from "@/lib/togetherNotify";

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
  console.error("[together:route] request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
    // The backend's own wording is for this log, not for a person.
    detail: error instanceof Error ? error.message : undefined,
  });
  if (error instanceof Base44FunctionError) {
    if (error.status === 401) {
      return unauthenticated();
    }
    // A 409 is the backend saying something true and useful — "one chapter at
    // a time", "connection not found". Everything else is plumbing, and
    // plumbing should never speak to the person in its own words.
    return Response.json(
      {
        error: error.status === 409
          ? error.message
          : withBackendDetail(
            "Together isn’t reachable right now.",
            error,
            error.status,
          ),
        code: "TOGETHER_BACKEND_FAILED",
      },
      { status: error.status === 409 ? 409 : 502 },
    );
  }
  if (
    error instanceof TogetherGenerationError ||
    error instanceof NowGenerationError ||
    error instanceof ParallelResearchError
  ) {
    return Response.json(
      { error: error.message, code: "TOGETHER_GENERATION_FAILED" },
      { status: 502 },
    );
  }
  return Response.json(
    { error: "Chapter couldn’t finish that just now.", code: "TOGETHER_FAILED" },
    { status: 502 },
  );
}

/**
 * The current Together state, and — for the initiator only — one step of
 * progress on an in-flight research run.
 *
 * Composition is deliberately the initiator's job alone. The partner polls the
 * same endpoint, but a draft is theirs to neither see nor advance: they cannot
 * spend a research run they don't know exists.
 */
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  try {
    const together = await fetchMyTogether(accessToken);
    const pending = together.chapters.find(
      (chapter) =>
        chapter.role === "initiator" &&
        chapter.status === "researching" &&
        chapter.researchRunId,
    );
    if (!pending?.researchRunId) {
      return Response.json({ value: together });
    }

    const result = await fetchParallelResearchResult(pending.researchRunId, 15);
    if (result.status === "pending") {
      return Response.json({ value: together });
    }

    const replace = (chapter: TogetherChapterRecord) => ({
      ...together,
      chapters: together.chapters.map((row) =>
        row.id === chapter.id ? chapter : row,
      ),
    });

    if (result.status === "failed") {
      const failed = await updateTogetherChapter(
        { chapterId: pending.id, status: "failed" },
        accessToken,
      );
      return Response.json({ value: replace(failed.chapter) });
    }

    // The brief is re-read from the record rather than kept client-side: it
    // holds both people's anchor ids, and only the server may hold those.
    const brief = pending.brief;
    if (!brief) {
      const failed = await updateTogetherChapter(
        { chapterId: pending.id, status: "failed" },
        accessToken,
      );
      return Response.json({ value: replace(failed.chapter) });
    }

    try {
      const composed = await composeTogetherChapter({
        // The composer works from labels alone. The anchors on this record are
        // already stripped to this viewer's node ids, and it needs none of them.
        brief: { anchors: brief.anchors, stretch: brief.stretch },
        researchContent: result.content,
        citations: result.citations,
        homeCity: together.homeCity,
        requestId,
        signal: request.signal,
      });
      const drafted = await updateTogetherChapter(
        {
          chapterId: pending.id,
          status: "draft",
          contentJson: JSON.stringify(composed.content),
          evidenceJson: JSON.stringify(composed.evidence),
          venueName: composed.content.venueName,
          partnerName: pending.partnerName,
        },
        accessToken,
      );
      console.info("[together:route] draft composed", {
        requestId,
        chapterId: pending.id,
      });
      return Response.json({ value: replace(drafted.chapter) });
    } catch (error) {
      console.error("[together:route] composition failed", {
        requestId,
        chapterId: pending.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      const failed = await updateTogetherChapter(
        { chapterId: pending.id, status: "failed" },
        accessToken,
      );
      return Response.json({ value: replace(failed.chapter) });
    }
  } catch (error) {
    return failure(error, requestId);
  }
}

type TogetherActionBody = {
  action?: unknown;
  connectionId?: unknown;
  chapterId?: unknown;
  proposedFor?: unknown;
  scheduledFor?: unknown;
  reason?: unknown;
  partnerName?: unknown;
};

function isoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : "";
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  let body: TogetherActionBody;
  try {
    body = (await request.json()) as TogetherActionBody;
  } catch {
    return Response.json(
      { error: "Invalid request.", code: "TOGETHER_INPUT_INVALID" },
      { status: 400 },
    );
  }

  try {
    if (body.action === "start") {
      const connectionId =
        typeof body.connectionId === "string" ? body.connectionId : "";
      if (!connectionId) {
        return Response.json(
          { error: "Pick someone first.", code: "TOGETHER_INPUT_INVALID" },
          { status: 400 },
        );
      }

      const together = await fetchMyTogether(accessToken);
      if (!together.homeCity) {
        return Response.json(
          {
            error: "Chapter needs your city first. Set it in Now.",
            code: "TOGETHER_NEEDS_CITY",
          },
          { status: 409 },
        );
      }

      const [graph, partner] = await Promise.all([
        fetchMyGraph(accessToken),
        fetchPartnerPlanningGraph(connectionId, accessToken),
      ]);
      if (graph.memoryCount === 0) {
        return Response.json(
          { error: "Share a memory first.", code: "TOGETHER_NEEDS_MEMORY" },
          { status: 409 },
        );
      }
      if (partner.graph.nodes.length === 0) {
        return Response.json(
          {
            error: `${partner.partnerName} hasn’t shared enough with Chapter yet.`,
            code: "TOGETHER_PARTNER_NOT_READY",
          },
          { status: 409 },
        );
      }

      console.info("[together:route] generation started", { requestId });
      const brief = await generateTogetherBrief({
        initiatorGraph: planningGraphFrom(graph),
        partnerGraph: partner.graph,
        homeCity: together.homeCity,
        partnerName: partner.partnerName,
        avoidVenues: together.avoidVenues,
        requestId,
        signal: request.signal,
      });

      const { runId } = await startParallelResearch({
        input: brief.researchObjective,
        outputSchema: NOW_RESEARCH_OUTPUT_SCHEMA as unknown as Record<
          string,
          unknown
        >,
        metadata: { app: "chapter", surface: "together" },
      });

      const created = await createTogetherChapter(
        {
          connectionId,
          researchRunId: runId,
          briefJson: JSON.stringify(brief),
        },
        accessToken,
      );
      console.info("[together:route] research run created", {
        requestId,
        chapterId: created.chapter.id,
      });
      return Response.json({ value: { chapter: created.chapter } });
    }

    const chapterId =
      typeof body.chapterId === "string" ? body.chapterId : "";
    const partnerName =
      typeof body.partnerName === "string" ? body.partnerName : "";
    if (!chapterId) {
      return Response.json(
        { error: "Missing chapter.", code: "TOGETHER_INPUT_INVALID" },
        { status: 400 },
      );
    }

    if (body.action === "send") {
      const proposedFor = isoDate(body.proposedFor);
      if (!proposedFor) {
        return Response.json(
          { error: "Pick a day first.", code: "TOGETHER_INPUT_INVALID" },
          { status: 400 },
        );
      }
      const value = await updateTogetherChapter(
        { chapterId, status: "proposed", proposedFor, partnerName },
        accessToken,
      );

      // The whole handshake rests on the other person finding out. The card is
      // already saved, so a failed text costs the ping and nothing else.
      const target = await fetchTogetherNotifyTarget(chapterId, accessToken)
        .catch(() => undefined);
      if (target) {
        await sendTogetherPing({
          phone: target.phone,
          text: proposalPingText({
            senderName: target.senderName,
            title: value.chapter.content?.title ?? "A chapter",
            proposedFor,
          }),
          requestId,
        });
      }
      return Response.json({ value });
    }

    if (body.action === "accept" || body.action === "decline") {
      const accepted = body.action === "accept";
      const value = await updateTogetherChapter(
        accepted
          ? {
            chapterId,
            status: "accepted",
            scheduledFor: isoDate(body.scheduledFor),
            partnerName,
          }
          : {
            chapterId,
            status: "declined",
            declineReason:
              typeof body.reason === "string" ? body.reason.slice(0, 300) : "",
            partnerName,
          },
        accessToken,
      );

      // Only the partner's answer travels back. An initiator retracting a
      // draft nobody has seen has nobody to tell.
      if (value.chapter.role === "partner") {
        const target = await fetchTogetherNotifyTarget(chapterId, accessToken)
          .catch(() => undefined);
        if (target) {
          await sendTogetherPing({
            phone: target.phone,
            text: answerPingText({
              partnerName: target.senderName,
              accepted,
              scheduledFor: value.chapter.scheduledFor,
            }),
            requestId,
          });
        }
      }
      return Response.json({ value });
    }

    if (body.action === "lived") {
      const value = await updateTogetherChapter(
        { chapterId, status: "lived", partnerName },
        accessToken,
      );
      return Response.json({ value });
    }

    return Response.json(
      { error: "Unknown action.", code: "TOGETHER_INPUT_INVALID" },
      { status: 400 },
    );
  } catch (error) {
    return failure(error, requestId);
  }
}

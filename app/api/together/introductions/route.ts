import {
  Base44FunctionError,
  fetchMyGraph,
  fetchMyIntroductions,
  findIntroductionCandidates,
  offerIntroduction,
  respondToIntroductionMessage,
  sendIntroductionMessage,
  setMyIntroductions,
} from "@/lib/base44Functions";
import { withBackendDetail } from "@/lib/backendFailureDetail";
import { writeIntroductionLines } from "@/lib/introductions";
import type {
  IntroductionRecord,
  IntroductionsState,
} from "@/lib/introductionSchema";
import {
  normalizeLabel,
  planningGraphFrom,
  shareableNodeIdsByLabel,
} from "@/lib/togetherGeneration";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function failed(error: unknown, requestId: string) {
  const status = error instanceof Base44FunctionError ? error.status : undefined;
  console.error("[together:introductions] request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
    status,
    detail: error instanceof Error ? error.message : String(error),
  });
  if (error instanceof Base44FunctionError && error.status === 401) {
    return unauthenticated();
  }
  return Response.json(
    {
      error: withBackendDetail(
        "Chapter couldn’t read that just now.",
        error,
        status,
      ),
      code: "TOGETHER_FAILED",
    },
    { status: 502 },
  );
}

/**
 * The reader's own node ids for the labels an introduction is built from.
 *
 * The backend deliberately returns labels without ids, because an id belongs
 * to one world and an introduction is written from two. Resolving them here,
 * against this reader's own graph, is what lets their own memories light up
 * without ever handing them a node they don't own.
 */
function litAnchors(
  introductions: readonly IntroductionRecord[],
  nodeIdsByLabel: ReadonlyMap<string, string>,
): IntroductionRecord[] {
  return introductions.map((introduction) => ({
    ...introduction,
    anchors: introduction.anchors.map((anchor) => {
      const nodeId = nodeIdsByLabel.get(normalizeLabel(anchor.label));
      return nodeId ? { ...anchor, nodeId } : anchor;
    }),
  }));
}

/**
 * The scan, and nothing else, when it can't be run.
 *
 * Looking for someone you haven't met is the one part of this read that is
 * made on another account's behalf, so it is the one part that can be refused
 * by the backend for reasons that have nothing to do with the reader. A
 * refusal here should cost the scan and leave the page standing.
 */
async function scanForCandidates(accessToken: string, requestId: string) {
  try {
    return await findIntroductionCandidates(accessToken);
  } catch (error) {
    console.error("[together:introductions] scan unavailable", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      status: error instanceof Base44FunctionError ? error.status : undefined,
      detail: error instanceof Error ? error.message : undefined,
    });
    return undefined;
  }
}

/**
 * Who Chapter has noticed for you among the people you have not met.
 *
 * Reading also offers. A scan that finds nobody costs one query and says so;
 * a scan that finds someone writes the sentence once and stores it, so the
 * same coincidence is never re-described differently on a later visit.
 */
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  try {
    const [existing, graph] = await Promise.all([
      fetchMyIntroductions(accessToken),
      fetchMyGraph(accessToken),
    ]);
    const nodeIdsByLabel = shareableNodeIdsByLabel(planningGraphFrom(graph));

    if (existing.muted) {
      return Response.json({
        value: {
          muted: true,
          introductions: [],
        } satisfies IntroductionsState,
      });
    }

    const settled = await scanForCandidates(accessToken, requestId);
    if (!settled) {
      // The scan is the part of this read that speaks to strangers, and it is
      // the part that can be refused for reasons the reader has no part in.
      // When it is, they still have the introductions they already had.
      return Response.json({
        value: {
          ...existing,
          introductions: litAnchors(existing.introductions, nodeIdsByLabel),
        } satisfies IntroductionsState,
      });
    }

    const { candidates, scanned, skipped } = settled;
    if (skipped) {
      // A bounded scan that reports nothing looks exactly like an empty pool.
      console.info("[together:introductions] scan truncated", {
        requestId,
        scanned,
        skipped,
      });
    }
    if (candidates.length === 0) {
      return Response.json({
        value: {
          ...existing,
          introductions: litAnchors(existing.introductions, nodeIdsByLabel),
        } satisfies IntroductionsState,
      });
    }

    const written = await writeIntroductionLines({
      threads: candidates.map((candidate) => ({
        otherUserId: candidate.userId,
        anchors: candidate.anchors,
        weight: candidate.weight,
      })),
      city: "",
      requestId,
      signal: request.signal,
    });

    // Written down together, and in the order they were ranked. One at a time
    // meant a round trip per offer before the page could say anything.
    const recorded = await Promise.all(
      written.map(async (introduction) => {
        try {
          const result = await offerIntroduction(
            {
              otherUserId: introduction.otherUserId,
              line: introduction.line,
              anchorsJson: JSON.stringify(introduction.anchors),
              weight: introduction.weight,
            },
            accessToken,
          );
          return result.introduction;
        } catch (error) {
          // One offer that can't be written down costs itself and nothing else.
          console.warn("[together:introductions] offer failed", {
            requestId,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
          return undefined;
        }
      }),
    );
    const offered = recorded.filter((one): one is IntroductionRecord =>
      Boolean(one),
    );

    const seen = new Set(existing.introductions.map((one) => one.id));
    return Response.json({
      value: {
        ...existing,
        introductions: litAnchors(
          [
            ...existing.introductions,
            ...offered.filter((one) => !seen.has(one.id)),
          ],
          nodeIdsByLabel,
        ),
      } satisfies IntroductionsState,
    });
  } catch (error) {
    return failed(error, requestId);
  }
}

/** Muting, sending an opener, or answering one. */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "Chapter couldn’t read that.", code: "TOGETHER_BAD_REQUEST" },
      { status: 400 },
    );
  }

  try {
    if (body.action === "mute") {
      const result = await setMyIntroductions(body.muted !== false, accessToken);
      return Response.json({ value: result });
    }

    if (body.action === "message") {
      const introductionId = typeof body.introductionId === "string"
        ? body.introductionId
        : "";
      const message = typeof body.message === "string"
        ? body.message.trim()
        : "";
      if (!introductionId || !message || message.length > 1_000) {
        return Response.json(
          { error: "Chapter couldn’t read that.", code: "TOGETHER_BAD_REQUEST" },
          { status: 400 },
        );
      }
      const result = await sendIntroductionMessage(
        { introductionId, message },
        accessToken,
      );
      return Response.json({ value: result });
    }

    if (body.action === "answer") {
      const introductionId = typeof body.introductionId === "string"
        ? body.introductionId
        : "";
      const answer = body.answer === "accept" || body.answer === "decline"
        ? body.answer
        : undefined;
      if (!introductionId || !answer) {
        return Response.json(
          { error: "Chapter couldn’t read that.", code: "TOGETHER_BAD_REQUEST" },
          { status: 400 },
        );
      }
      const result = await respondToIntroductionMessage(
        { introductionId, answer },
        accessToken,
      );
      return Response.json({ value: result });
    }

    return Response.json(
      { error: "Chapter couldn’t read that.", code: "TOGETHER_BAD_REQUEST" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof Base44FunctionError && error.status === 409) {
      return Response.json(
        { error: "That request has already closed.", code: "TOGETHER_ANSWERED" },
        { status: 409 },
      );
    }
    if (error instanceof Base44FunctionError && error.status === 410) {
      return Response.json(
        { error: "That one has closed.", code: "TOGETHER_CLOSED" },
        { status: 410 },
      );
    }
    return failed(error, requestId);
  }
}

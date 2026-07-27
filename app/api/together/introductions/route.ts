import {
  Base44FunctionError,
  fetchMyGraph,
  fetchMyIntroductions,
  findIntroductionCandidates,
  offerIntroduction,
  respondToIntroduction,
  setMyIntroductions,
} from "@/lib/base44Functions";
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
  console.error("[together:introductions] request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  if (error instanceof Base44FunctionError && error.status === 401) {
    return unauthenticated();
  }
  return Response.json(
    { error: "Chapter couldn’t read that just now.", code: "TOGETHER_FAILED" },
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

    if (!existing.optedIn) {
      return Response.json({
        value: {
          optedIn: false,
          homeCity: existing.homeCity,
          introductions: [],
        } satisfies IntroductionsState,
      });
    }

    const { candidates, matchCity, scanned, skipped } =
      await findIntroductionCandidates(accessToken);
    if (skipped) {
      // A bounded scan that reports nothing looks exactly like an empty city.
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

    const city = existing.homeCity || matchCity || "";
    const written = await writeIntroductionLines({
      threads: candidates.map((candidate) => ({
        otherUserId: candidate.userId,
        anchors: candidate.anchors,
        weight: candidate.weight,
      })),
      city,
      requestId,
      signal: request.signal,
    });

    const offered: IntroductionRecord[] = [];
    for (const introduction of written) {
      try {
        const result = await offerIntroduction(
          {
            otherUserId: introduction.otherUserId,
            line: introduction.line,
            anchorsJson: JSON.stringify(introduction.anchors),
            weight: introduction.weight,
            matchCity: matchCity || city,
          },
          accessToken,
        );
        if (result.introduction) offered.push(result.introduction);
      } catch (error) {
        // One offer that can't be written down costs itself and nothing else.
        console.warn("[together:introductions] offer failed", {
          requestId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }

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

/** Opting in or out, and answering one offer. */
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
    if (body.action === "optIn") {
      const result = await setMyIntroductions(body.optIn === true, accessToken);
      return Response.json({ value: result });
    }

    if (body.action === "answer") {
      const introductionId = typeof body.introductionId === "string"
        ? body.introductionId
        : "";
      const answer = body.answer === "yes" || body.answer === "no"
        ? body.answer
        : undefined;
      if (!introductionId || !answer) {
        return Response.json(
          { error: "Chapter couldn’t read that.", code: "TOGETHER_BAD_REQUEST" },
          { status: 400 },
        );
      }
      const result = await respondToIntroduction(
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
        { error: "That one was already answered.", code: "TOGETHER_ANSWERED" },
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

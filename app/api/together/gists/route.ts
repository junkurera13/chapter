import {
  Base44FunctionError,
  fetchMyConnections,
  fetchMyGraph,
  fetchMySession,
  fetchPartnerPlanningGraph,
} from "@/lib/base44Functions";
import { planningGraphFrom } from "@/lib/togetherGeneration";
import {
  demoGists,
  findGistAnchors,
  generateGistLines,
  isDemoAccount,
  type TogetherGistThread,
} from "@/lib/togetherGists";
import type { TogetherGist } from "@/lib/togetherGistSchema";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Enough for every real graph; a ceiling so one account can't fan out forever. */
const MAX_PEOPLE = 8;
/**
 * A written gist outlives the request that made it: the same two worlds
 * produce the same sentence until one of them changes, and the key already
 * carries the threads it was written from. Warm instances therefore open
 * Together with no model call at all.
 */
const LINE_TTL_MS = 12 * 60 * 60 * 1000;

const writtenLines = new Map<string, { line: string; savedAt: number }>();

function lineKey(thread: TogetherGistThread) {
  return [
    thread.connectionId,
    thread.partnerName,
    thread.anchors.map((anchor) => anchor.label).join("|"),
  ].join("::");
}

function rememberedLine(thread: TogetherGistThread) {
  const entry = writtenLines.get(lineKey(thread));
  if (!entry) return undefined;
  if (Date.now() - entry.savedAt > LINE_TTL_MS) {
    writtenLines.delete(lineKey(thread));
    return undefined;
  }
  return entry.line;
}

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
 * What the two of you turn out to share, for every person you're connected to.
 *
 * Deliberately its own endpoint. Chapter's answer here changes when a world
 * changes — not second to second — so it is read once when Together opens and
 * left alone, while `/api/together` stays small enough to poll while a chapter
 * is being written.
 */
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  try {
    const [connections, graph, session] = await Promise.all([
      fetchMyConnections(accessToken),
      fetchMyGraph(accessToken),
      fetchMySession(accessToken).catch(() => undefined),
    ]);
    // Samples sit behind whatever is real, so a genuine gist is never demoted
    // by one — and an account that isn't the demo account never sees them.
    const samples = isDemoAccount(session?.viewer.email) ? demoGists() : [];

    const people = connections.accepted.slice(0, MAX_PEOPLE);
    if (people.length === 0) {
      return Response.json({ value: { gists: samples } });
    }

    const mine = planningGraphFrom(graph);
    const threads: TogetherGistThread[] = [];
    await Promise.all(
      people.map(async (person) => {
        try {
          const partner = await fetchPartnerPlanningGraph(
            person.id,
            accessToken,
          );
          const anchors = findGistAnchors({
            mine,
            theirs: partner.graph,
          });
          if (anchors.length === 0) return;
          threads.push({
            connectionId: person.id,
            // The name in your own world wins: Chapter should call them what
            // you call them, not what their account says.
            partnerName: person.name || partner.partnerName,
            anchors,
          });
        } catch (error) {
          // One unreachable world costs its own gist and nothing else.
          console.warn("[together:gists] partner unreadable", {
            requestId,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
        }
      }),
    );

    const remembered = new Map<string, TogetherGist>();
    const unwritten: TogetherGistThread[] = [];
    for (const thread of threads) {
      const line = rememberedLine(thread);
      if (!line) {
        unwritten.push(thread);
        continue;
      }
      remembered.set(thread.connectionId, {
        connectionId: thread.connectionId,
        partnerName: thread.partnerName,
        anchors: thread.anchors.filter((anchor) => line.includes(anchor.label)),
        line,
      });
    }

    const written = await generateGistLines({
      threads: unwritten,
      requestId,
      signal: request.signal,
    });
    for (const gist of written) {
      const thread = unwritten.find(
        (candidate) => candidate.connectionId === gist.connectionId,
      );
      if (thread) {
        writtenLines.set(lineKey(thread), {
          line: gist.line,
          savedAt: Date.now(),
        });
      }
      remembered.set(gist.connectionId, gist);
    }

    // Back into the order the people came in, so the page doesn't reshuffle.
    const gists = threads
      .map((thread) => remembered.get(thread.connectionId))
      .filter((gist): gist is TogetherGist => Boolean(gist));

    return Response.json({ value: { gists: [...gists, ...samples] } });
  } catch (error) {
    console.error("[together:gists] request failed", {
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
}

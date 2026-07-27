import {
  Base44FunctionError,
  fetchMyConnections,
  fetchMyGraph,
  fetchMySession,
  fetchPartnerPlanningGraph,
  fetchTogetherGistSource,
} from "@/lib/base44Functions";
import type { TogetherPlanningGraph } from "@/lib/togetherChapterSchema";
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

type GistSource = {
  viewerEmail: string;
  mine: TogetherPlanningGraph;
  partners: Array<{
    connectionId: string;
    partnerName: string;
    graph: TogetherPlanningGraph;
  }>;
};

/**
 * The same reads, the long way round: one call for the connections, one for
 * the graph, one for the session, one more per person.
 *
 * Kept only so that a Vercel deploy landing before its Base44 one degrades to
 * the speed it used to have rather than to an empty tab. The two halves of
 * Chapter ship separately, and the fast path is a backend action the older
 * backend has never heard of.
 */
async function gistSourceTheLongWay(
  accessToken: string,
  requestId: string,
): Promise<GistSource> {
  const [connections, graph, session] = await Promise.all([
    fetchMyConnections(accessToken),
    fetchMyGraph(accessToken),
    fetchMySession(accessToken).catch(() => undefined),
  ]);

  const people = connections.accepted.slice(0, MAX_PEOPLE);
  const partners = await Promise.all(
    people.map(async (person) => {
      try {
        const partner = await fetchPartnerPlanningGraph(person.id, accessToken);
        return {
          connectionId: person.id,
          // The name in your own world wins: Chapter should call them what
          // you call them, not what their account says.
          partnerName: person.name || partner.partnerName,
          graph: partner.graph,
        };
      } catch (error) {
        // One unreachable world costs its own gist and nothing else.
        console.warn("[together:gists] partner unreadable", {
          requestId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        return undefined;
      }
    }),
  );

  return {
    viewerEmail: session?.viewer.email ?? "",
    mine: planningGraphFrom(graph),
    partners: partners.filter(
      (partner): partner is GistSource["partners"][number] => Boolean(partner),
    ),
  };
}

/**
 * Everything a gist is made of, in one call where that works, and the long
 * way round where it doesn't.
 *
 * The single call is an optimisation, and an optimisation must not be able to
 * take the tab down. It gets one shot at anything: an older backend that has
 * never heard of the action, a secret the two deployments disagree about, a
 * response too large to come back in one piece. The long way is slow, but it
 * reads every world separately and loses only the ones it can't reach, which
 * is exactly the failure Together used to survive without noticing.
 *
 * An expired session is the one thing not worth retrying, because the long
 * way is holding the same expired token.
 */
async function readGistSource(
  accessToken: string,
  requestId: string,
): Promise<GistSource> {
  try {
    return await fetchTogetherGistSource({ limit: MAX_PEOPLE }, accessToken);
  } catch (error) {
    if (error instanceof Base44FunctionError && error.status === 401) {
      throw error;
    }
    // Logged with the status and the message, not just the error's name: the
    // difference between 400 and 403 here is the difference between a stale
    // backend and a misconfigured one, and the name says neither.
    console.warn("[together:gists] single-call source unavailable", {
      requestId,
      status: error instanceof Base44FunctionError ? error.status : undefined,
      detail: error instanceof Error ? error.message : String(error),
    });
    return gistSourceTheLongWay(accessToken, requestId);
  }
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
    // One call, not one per person. Everything below is arithmetic on what it
    // returns, so nothing here waits on the network again until the writing.
    const source = await readGistSource(accessToken, requestId);
    // Samples sit behind whatever is real, so a genuine gist is never demoted
    // by one — and an account that isn't the demo account never sees them.
    const samples = isDemoAccount(source.viewerEmail) ? demoGists() : [];

    if (source.partners.length === 0) {
      return Response.json({ value: { gists: samples } });
    }

    const threads: TogetherGistThread[] = [];
    for (const partner of source.partners) {
      const anchors = findGistAnchors({
        mine: source.mine,
        theirs: partner.graph,
      });
      if (anchors.length === 0) continue;
      threads.push({
        connectionId: partner.connectionId,
        partnerName: partner.partnerName,
        anchors,
      });
    }

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
    const detail = error instanceof Error ? error.message : String(error);
    const status = error instanceof Base44FunctionError
      ? error.status
      : undefined;
    console.error("[together:gists] request failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      status,
      detail,
    });
    if (error instanceof Base44FunctionError && error.status === 401) {
      return unauthenticated();
    }
    return Response.json(
      {
        error: "Chapter couldn’t read that just now.",
        code: "TOGETHER_FAILED",
        // The reason, where saying it out loud costs nothing. In production
        // this is a backend's own words to a browser, so it stays server-side.
        ...(process.env.NODE_ENV === "production" ? {} : { detail, status }),
      },
      { status: 502 },
    );
  }
}

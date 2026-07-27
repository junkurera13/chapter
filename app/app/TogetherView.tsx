"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ChapterLoadingMark from "../../components/chapter-loading-mark";
import {
  acceptTogetherChapter,
  declineTogetherChapter,
  loadTogether,
  loadTogetherGists,
  markTogetherChapterLived,
  sendTogetherChapter,
  startTogetherChapter,
  type TogetherState,
  TogetherRequestError,
} from "../../lib/togetherClient";
import type { TogetherChapterRecord } from "../../lib/togetherChapterSchema";
import type { TogetherGist } from "../../lib/togetherGistSchema";
import { categoryOrbGradient } from "./categoryAppearance";
import type { WorldNode } from "./graphData";
import TogetherGistCard from "./TogetherGistCard";
import TogetherFriendsCard, {
  type TogetherPerson,
} from "./TogetherFriendsCard";
import styles from "./TogetherView.module.css";

/** Fast only while a chapter is actually being written; idle otherwise. */
const RESEARCH_POLL_MS = 8_000;

const RESEARCH_STAGES = [
  "Reading both your worlds",
  "Following the thread you share",
  "Searching where lists don’t reach",
  "Checking it’s really there",
  "Writing your chapter",
] as const;

const OPEN_STATUSES = ["researching", "draft", "proposed", "accepted"] as const;

function isOpen(chapter: TogetherChapterRecord) {
  return (OPEN_STATUSES as readonly string[]).includes(chapter.status);
}

/**
 * What Chapter leads with. Anything waiting on this person comes first, then
 * anything it is still working on, then the gists it simply noticed.
 */
function priorityOf(chapter?: TogetherChapterRecord) {
  if (!chapter) return 5;
  if (chapter.status === "proposed") {
    return chapter.role === "partner" ? 0 : 4;
  }
  if (chapter.status === "draft") return 1;
  if (chapter.status === "researching") return 2;
  if (chapter.status === "accepted") return 3;
  return 5;
}

type TogetherEntry = {
  connectionId: string;
  partnerName: string;
  gist?: TogetherGist;
  chapter?: TogetherChapterRecord;
};

/**
 * One card per person Chapter has something to say about, whether that is a
 * gist it found on its own or a chapter already in motion. A person with both
 * gets one card, not two.
 */
function buildEntries(
  chapters: readonly TogetherChapterRecord[],
  gists: readonly TogetherGist[],
): TogetherEntry[] {
  const byConnection = new Map<string, TogetherEntry>();
  for (const gist of gists) {
    byConnection.set(gist.connectionId, {
      connectionId: gist.connectionId,
      partnerName: gist.partnerName,
      gist,
    });
  }
  for (const chapter of chapters.filter(isOpen)) {
    const existing = byConnection.get(chapter.connectionId);
    byConnection.set(chapter.connectionId, {
      connectionId: chapter.connectionId,
      partnerName: existing?.partnerName || chapter.partnerName,
      gist: existing?.gist,
      chapter,
    });
  }
  return [...byConnection.values()].sort(
    (first, second) =>
      priorityOf(first.chapter) - priorityOf(second.chapter) ||
      first.partnerName.localeCompare(second.partnerName),
  );
}

/**
 * Everyone in your world, sorted so the people Chapter can already work with
 * come first and the ones still only in your memories sit below them.
 */
function buildPeople(
  nodes: readonly WorldNode[],
  connectedNames: ReadonlySet<string>,
): TogetherPerson[] {
  const order: Record<TogetherPerson["presence"], number> = {
    connected: 0,
    invited: 1,
    remembered: 2,
  };
  return nodes
    .filter((node) => node.category === "people")
    .map((node) => ({
      nodeId: node.key,
      name: node.label,
      presence: (node.linkedUserId ||
        node.connectionId ||
        connectedNames.has(node.label.trim().toLowerCase())
        ? "connected"
        : node.inviteStatus === "pending"
          ? "invited"
          : "remembered") as TogetherPerson["presence"],
    }))
    .sort(
      (first, second) =>
        order[first.presence] - order[second.presence] ||
        first.name.localeCompare(second.name),
    );
}

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; together: TogetherState };

export default function TogetherView({
  nodes,
  onOpenYou,
  onGraphAdvanced,
}: {
  nodes: readonly WorldNode[];
  onOpenYou: () => void;
  onGraphAdvanced?: () => void;
}) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [gists, setGists] = useState<TogetherGist[]>([]);
  const [reading, setReading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  /** Which card a failure belongs to, so it lands under the button pressed. */
  const [noticeFor, setNoticeFor] = useState("");

  const refresh = useCallback(async () => {
    try {
      setState({ status: "ready", together: await loadTogether() });
    } catch (error) {
      console.error("Could not load Together", error);
      setState({
        status: "error",
        message:
          error instanceof TogetherRequestError
            ? error.message
            : "Together couldn’t open.",
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const together = await loadTogether();
        if (active) setState({ status: "ready", together });
      } catch (error) {
        console.error("Could not load Together", error);
        if (active) {
          setState({
            status: "error",
            message:
              error instanceof TogetherRequestError
                ? error.message
                : "Together couldn’t open.",
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Read once. What two worlds share changes when a world changes, not while
  // someone is looking at it — so this never polls and never blocks the page.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const found = await loadTogetherGists();
        if (active) setGists(found.gists);
      } catch (error) {
        console.error("Could not read your gists", error);
      } finally {
        if (active) setReading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const chapters = useMemo(
    () => (state.status === "ready" ? state.together.chapters : []),
    [state],
  );
  const researching = chapters.some(
    (chapter) => chapter.status === "researching",
  );
  const waiting = chapters.some(
    (chapter) => chapter.status === "proposed" && chapter.role === "initiator",
  );

  // Poll hard only while research is in flight. A pair waiting on an answer
  // refreshes when the tab comes back instead — the backend reads several
  // entities per call, and nothing here changes second to second.
  useEffect(() => {
    if (!researching) return;
    const poll = window.setInterval(() => void refresh(), RESEARCH_POLL_MS);
    const stage = window.setInterval(
      () =>
        setStageIndex((index) =>
          Math.min(index + 1, RESEARCH_STAGES.length - 1),
        ),
      14_000,
    );
    return () => {
      window.clearInterval(poll);
      window.clearInterval(stage);
    };
  }, [researching, refresh]);

  useEffect(() => {
    if (!waiting && !researching) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [waiting, researching, refresh]);

  const runAction = useCallback(
    async (
      cardId: string,
      action: () => Promise<unknown>,
      failureNotice: string,
    ) => {
      setBusy(true);
      setNotice("");
      setNoticeFor(cardId);
      try {
        await action();
        await refresh();
      } catch (error) {
        setNotice(
          error instanceof TogetherRequestError ? error.message : failureNotice,
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const entries = useMemo(
    () => buildEntries(chapters, gists),
    [chapters, gists],
  );
  /**
   * A safety net for the people rail. A person's node normally carries the
   * connection itself, but graph projection can merge the node that held it —
   * and someone Chapter is actively planning with must never be offered an
   * invitation as though they were still only a memory.
   */
  const connectedNames = useMemo(
    () =>
      new Set(
        [
          ...gists.map((gist) => gist.partnerName),
          ...chapters.map((chapter) => chapter.partnerName),
        ]
          .map((name) => name.trim().toLowerCase())
          .filter(Boolean),
      ),
    [gists, chapters],
  );
  const people = useMemo(
    () => buildPeople(nodes, connectedNames),
    [nodes, connectedNames],
  );

  if (state.status === "loading") {
    return (
      <div className={styles.loading} aria-busy="true">
        <ChapterLoadingMark label="Opening Together" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.state}>
        <h1>{state.message}</h1>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            void refresh();
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  if (people.length === 0) {
    return (
      <section className={styles.state}>
        <div className={styles.emptyOrbs} aria-hidden="true">
          <span style={{ background: categoryOrbGradient("self") }} />
          <span style={{ background: categoryOrbGradient("people") }} />
        </div>
        <h1>Nobody is in your world yet.</h1>
        <button type="button" onClick={onOpenYou}>
          Open your world
        </button>
      </section>
    );
  }

  const pastChapters = chapters.filter((chapter) => !isOpen(chapter));
  const noticeOrphaned = Boolean(
    notice && !entries.some((entry) => entry.connectionId === noticeFor),
  );

  return (
    <section className={styles.together}>
      <div className={styles.main}>
        {entries.length === 0 ? (
          <h1 className={styles.quietHeading}>
            {reading
              ? "Chapter is reading your worlds."
              : people.some((person) => person.presence === "connected")
                ? "Nothing yet runs through both your worlds."
                : "No one you know is here yet."}
          </h1>
        ) : (
          <div className={styles.gists}>
            {entries.map((entry) => {
              /**
               * Every chapter action is rendered by a card state that only exists
               * once a chapter does. This keeps that promise honest rather than
               * asserting it, so a stale render can't reach for a missing id.
               */
              const onChapter = (
                act: (chapterId: string) => Promise<unknown>,
                failureNotice: string,
              ) => {
                const chapterId = entry.chapter?.id;
                if (!chapterId) return;
                void runAction(
                  entry.connectionId,
                  () => act(chapterId),
                  failureNotice,
                );
              };

              return (
              <TogetherGistCard
                key={entry.connectionId}
                partnerName={entry.partnerName}
                gist={entry.gist}
                chapter={entry.chapter}
                busy={busy}
                notice={noticeFor === entry.connectionId ? notice : ""}
                stageLabel={RESEARCH_STAGES[stageIndex]}
                onGo={() =>
                  void runAction(
                    entry.connectionId,
                    () => startTogetherChapter(entry.connectionId),
                    "Chapter couldn’t start writing.",
                  )
                }
                onSend={(proposedFor) =>
                  onChapter(
                    (chapterId) =>
                      sendTogetherChapter(
                        chapterId,
                        proposedFor,
                        entry.partnerName,
                      ),
                    "Chapter couldn’t send that.",
                  )
                }
                onAccept={(scheduledFor) =>
                  onChapter(
                    (chapterId) =>
                      acceptTogetherChapter(
                        chapterId,
                        scheduledFor,
                        entry.partnerName,
                      ),
                    "Chapter couldn’t save that.",
                  )
                }
                onDecline={(reason) =>
                  onChapter(
                    (chapterId) =>
                      declineTogetherChapter(chapterId, reason, entry.partnerName),
                    "Chapter couldn’t record that.",
                  )
                }
                onLived={() =>
                  onChapter(
                    (chapterId) =>
                      markTogetherChapterLived(chapterId, entry.partnerName),
                    "Chapter couldn’t record that.",
                  )
                }
              />
              );
            })}
          </div>
        )}

        {noticeOrphaned ? <p className={styles.notice}>{notice}</p> : null}
      </div>

      {/* The standing furniture of the tab: who you have, and what's behind you. */}
      <div className={styles.rail}>
        <TogetherFriendsCard people={people} onInviteCreated={onGraphAdvanced} />

        {pastChapters.length > 0 ? (
          <section className={styles.past}>
            <p className={styles.railLabel}>Behind you</p>
            <ul>
              {pastChapters.slice(0, 6).map((chapter) => (
                <li key={chapter.id}>
                  <span>{chapter.content?.title ?? "A chapter"}</span>
                  <span>{chapter.partnerName}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ChapterLoadingMark from "../../components/chapter-loading-mark";
import {
  acceptTogetherChapter,
  answerIntroduction,
  declineTogetherChapter,
  loadIntroductions,
  loadTogether,
  loadTogetherGists,
  markTogetherChapterLived,
  sendTogetherChapter,
  muteIntroductions,
  startTogetherChapter,
  type TogetherState,
  TogetherRequestError,
} from "../../lib/togetherClient";
import type {
  IntroductionRecord,
  IntroductionsState,
} from "../../lib/introductionSchema";
import {
  lastOpened,
  OPENED_GISTS,
  OPENED_INTRODUCTIONS,
  OPENED_TOGETHER,
} from "../../lib/openedViews";
import { buildEntries, isOpen } from "../../lib/togetherEntries";
import type {
  TogetherGist,
  TogetherGistsState,
} from "../../lib/togetherGistSchema";
import { demoGists } from "../../lib/togetherSamples";
import { categoryOrbGradient } from "./categoryAppearance";
import type { WorldNode } from "./graphData";
import TogetherGistCard from "./TogetherGistCard";
import TogetherFriendsCard, {
  type TogetherPerson,
} from "./TogetherFriendsCard";
import styles from "./TogetherView.module.css";

/**
 * Only while a chapter is actually being written; idle otherwise. A research
 * run takes minutes, so asking every eight seconds bought nothing and spent a
 * rate limit the reads that people are waiting on also have to pass through.
 */
const RESEARCH_POLL_MS = 15_000;

const RESEARCH_STAGES = [
  "Reading both your worlds",
  "Following the thread you share",
  "Searching where lists don’t reach",
  "Checking it’s really there",
  "Writing your chapter",
] as const;

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
  showSamples = false,
  onOpenYou,
  onGraphAdvanced,
}: {
  nodes: readonly WorldNode[];
  /** This account sees sample gists behind whatever is real. */
  showSamples?: boolean;
  onOpenYou: () => void;
  onGraphAdvanced?: () => void;
}) {
  /**
   * What this tab already knew, if it has been open before. Together unmounts
   * when you leave it, and everything behind it is a network read, so a second
   * visit would otherwise start from the same blank screen as the first.
   */
  const opened = lastOpened<TogetherState>(OPENED_TOGETHER);
  const openedGists = lastOpened<TogetherGistsState>(OPENED_GISTS);
  const openedIntroductions = lastOpened<IntroductionsState>(
    OPENED_INTRODUCTIONS,
  );

  const [state, setState] = useState<ViewState>(
    opened ? { status: "ready", together: opened } : { status: "loading" },
  );
  // Samples are constants. They have no business waiting on a round trip, let
  // alone on the model call that writes the real ones.
  const [gists, setGists] = useState<TogetherGist[]>(
    openedGists?.gists ?? (showSamples ? demoGists() : []),
  );
  const [introductions, setIntroductions] = useState<IntroductionRecord[]>(
    openedIntroductions?.introductions ?? [],
  );
  /** True until the gist request has answered, either way. */
  const [reading, setReading] = useState(!openedGists);
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
      // A failed re-read of a tab that is already standing is not a reason to
      // take it down. What was true a moment ago stays on screen.
      setState((current) =>
        current.status === "ready"
          ? current
          : {
              status: "error",
              message:
                error instanceof TogetherRequestError
                  ? error.message
                  : "Together couldn’t open.",
            },
      );
    }
  }, []);

  const readIntroductions = useCallback(async () => {
    try {
      const found = await loadIntroductions();
      setIntroductions(found.introductions);
    } catch (error) {
      console.error("Could not read your introductions", error);
    }
  }, []);

  /**
   * Opening Together, one read at a time and in the order they matter.
   *
   * These used to start together, which read as three independent things
   * refusing to block each other. Behind them they are not independent at all:
   * they are three requests to one backend, each fanning out into several
   * more, and the pool scan alone opens a stranger's world for every candidate
   * it weighs. Started at once they don't finish sooner, they rate-limit each
   * other, and the page ends up with none of the three.
   *
   * So the chapters come first, because they are what the tab is for. Gists
   * follow. The search among strangers goes last: it is the most expensive
   * read Chapter makes and the only one nobody is waiting on.
   *
   * A gist and an introduction are both answers to "what do these two worlds
   * share", which changes when a world changes and not while someone is
   * looking at the page. So when this tab has been open before, they are not
   * asked for again — the answer on screen is the answer.
   */
  useEffect(() => {
    let active = true;
    void (async () => {
      await refresh();
      if (!active) return;

      if (openedGists) {
        setReading(false);
      } else {
        try {
          const found = await loadTogetherGists();
          if (active) setGists(found.gists);
        } catch (error) {
          console.error("Could not read your gists", error);
        } finally {
          if (active) setReading(false);
        }
      }
      if (!active || openedIntroductions) return;

      await readIntroductions();
    })();
    return () => {
      active = false;
    };
    // Deliberately once per mount: the seeds are read at mount and the two
    // loaders are stable, so re-running this would only re-ask the backend
    // for what the page already has on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Poll only while research is in flight, and only while someone is there to
  // see it land. The backend reads several entities per call and answers 429
  // when asked too often, so a poll running behind a hidden tab is load spent
  // on nobody that the visible reads then have to compete with.
  useEffect(() => {
    if (!researching) return;
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, RESEARCH_POLL_MS);
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

  /**
   * An answer is final, so the card goes as soon as it is given rather than
   * after a round trip. A yes that turns out to be mutual arrives back as a
   * real connection, with a name on it, through the ordinary refresh.
   */
  const onAnswerIntroduction = useCallback(
    async (introductionId: string, answer: "yes" | "no") => {
      setBusy(true);
      setNotice("");
      setNoticeFor(introductionId);
      try {
        const result = await answerIntroduction(introductionId, answer);
        if (result.connected) {
          setIntroductions((current) =>
            current.filter((one) => one.id !== introductionId),
          );
          await Promise.all([refresh(), readIntroductions()]);
          const found = await loadTogetherGists().catch(() => undefined);
          if (found) setGists(found.gists);
          onGraphAdvanced?.();
        } else if (answer === "no") {
          setIntroductions((current) =>
            current.filter((one) => one.id !== introductionId),
          );
        } else {
          setIntroductions((current) =>
            current.map((one) =>
              one.id === introductionId ? { ...one, state: "waiting" } : one,
            ),
          );
        }
      } catch (error) {
        setNotice(
          error instanceof TogetherRequestError
            ? error.message
            : "Chapter couldn’t record that.",
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh, readIntroductions, onGraphAdvanced],
  );

  /**
   * The way out, asked for from the card it is about rather than from a
   * setting somewhere else. Every live offer goes with it, on both sides.
   */
  const onMuteIntroductions = useCallback(
    async (cardId: string) => {
      setBusy(true);
      setNotice("");
      setNoticeFor(cardId);
      try {
        await muteIntroductions();
        setIntroductions([]);
      } catch (error) {
        setNotice(
          error instanceof TogetherRequestError
            ? error.message
            : "Chapter couldn’t save that.",
        );
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const entries = useMemo(
    () => buildEntries(chapters, gists, introductions),
    [chapters, gists, introductions],
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
          // A sample names someone you may not actually be connected to, so it
          // is not evidence of anything about the people rail.
          ...gists.filter((gist) => !gist.demo).map((gist) => gist.partnerName),
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

  // Someone with no people in their world can still have somewhere to be and
  // something they love, which is all an introduction is made of — so the
  // empty state only holds when there is nothing on either side of the tab.
  if (people.length === 0 && introductions.length === 0) {
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
  // A failure belongs under the button that caused it. It only floats free
  // when the card that owned it has already gone.
  const noticeOrphaned = Boolean(
    notice && !entries.some((entry) => entry.id === noticeFor),
  );

  return (
    <section className={styles.together}>
      <div className={styles.main}>
        {/*
          Saying nothing until the search has answered. "Looking" is only true
          of an empty page, and a page that already has gists on it must never
          flash it on the way to filling up.
        */}
        {entries.length > 0 ? (
          <h1 className={styles.title}>
            Chapter found {entries.length}{" "}
            {entries.length === 1 ? "gist" : "gists"} for you
          </h1>
        ) : reading ? null : (
          <h1 className={styles.title}>Chapter is looking for gists</h1>
        )}

        {entries.length > 0 ? (
          <div className={styles.gists}>
            {entries.map((entry) => {
              /**
               * Every chapter action is rendered by a card state that only exists
               * once a chapter does. This keeps that promise honest rather than
               * asserting it, so a stale render can't reach for a missing id.
               */
              const onChapter = (
                act: (chapterId: string, partnerName: string) => Promise<unknown>,
                failureNotice: string,
              ) => {
                const chapter = entry.chapter;
                if (!chapter) return;
                // A chapter carries the name it was planned with, so the one
                // place a name is required is the one place it always exists.
                void runAction(
                  entry.id,
                  () =>
                    act(chapter.id, entry.partnerName || chapter.partnerName),
                  failureNotice,
                );
              };

              return (
              <TogetherGistCard
                key={entry.id}
                partnerName={entry.partnerName}
                gist={entry.gist}
                introduction={entry.introduction}
                chapter={entry.chapter}
                busy={busy}
                notice={noticeFor === entry.id ? notice : ""}
                stageLabel={RESEARCH_STAGES[stageIndex]}
                onAnswer={(answer) =>
                  void onAnswerIntroduction(entry.id, answer)
                }
                onMute={() => void onMuteIntroductions(entry.id)}
                onGo={() => {
                  // Deep research costs real money, and a sample has no real
                  // person behind it. It says so rather than spending anything.
                  if (entry.gist?.demo) {
                    setNoticeFor(entry.id);
                    setNotice("A sample, for now.");
                    return;
                  }
                  void runAction(
                    entry.id,
                    () => startTogetherChapter(entry.id),
                    "Chapter couldn’t start writing.",
                  );
                }}
                onSend={(proposedFor) =>
                  onChapter(
                    (chapterId, partnerName) =>
                      sendTogetherChapter(chapterId, proposedFor, partnerName),
                    "Chapter couldn’t send that.",
                  )
                }
                onAccept={(scheduledFor) =>
                  onChapter(
                    (chapterId, partnerName) =>
                      acceptTogetherChapter(
                        chapterId,
                        scheduledFor,
                        partnerName,
                      ),
                    "Chapter couldn’t save that.",
                  )
                }
                onDecline={(reason) =>
                  onChapter(
                    (chapterId, partnerName) =>
                      declineTogetherChapter(chapterId, reason, partnerName),
                    "Chapter couldn’t record that.",
                  )
                }
                onLived={() =>
                  onChapter(
                    (chapterId, partnerName) =>
                      markTogetherChapterLived(chapterId, partnerName),
                    "Chapter couldn’t record that.",
                  )
                }
              />
              );
            })}
          </div>
        ) : null}

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

"use client";

import { useCallback, useEffect, useState } from "react";

import AnchoredCopy from "../../components/anchored-copy";
import ChapterLoadingMark from "../../components/chapter-loading-mark";
import { loadMyConnections } from "../../lib/base44Connections";
import type { MyConnectionsRecord } from "../../lib/backendTypes";
import { nextSaturdayIso } from "../../lib/nowClient";
import {
  acceptTogetherChapter,
  declineTogetherChapter,
  loadTogether,
  markTogetherChapterLived,
  sendTogetherChapter,
  startTogetherChapter,
  type TogetherState,
  TogetherRequestError,
} from "../../lib/togetherClient";
import type { TogetherChapterRecord } from "../../lib/togetherChapterSchema";
import styles from "./TogetherView.module.css";

/** Fast only while a chapter is actually being written; idle otherwise. */
const RESEARCH_POLL_MS = 8_000;

const RESEARCH_STAGES = [
  "Reading both your worlds",
  "Finding the thread you share",
  "Searching where lists don’t reach",
  "Checking it’s really there",
  "Writing your chapter",
] as const;

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      together: TogetherState;
      connections: MyConnectionsRecord;
    };

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || "·";
}

function todayIso() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function friendlyDate(iso?: string) {
  if (!iso) return "";
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const OPEN_STATUSES = ["researching", "draft", "proposed", "accepted"] as const;

function isOpen(chapter: TogetherChapterRecord) {
  return (OPEN_STATUSES as readonly string[]).includes(chapter.status);
}

/** The one-line state of a card, in the second person. */
function statusLine(chapter: TogetherChapterRecord) {
  const { role, status, partnerName } = chapter;
  if (status === "researching") return `Chapter is writing this for you and ${partnerName}`;
  if (status === "draft") return "Only you can see this";
  if (status === "proposed") {
    return role === "initiator"
      ? `Waiting on ${partnerName}`
      : `${partnerName} planned this for you`;
  }
  if (status === "accepted") {
    return chapter.youLived
      ? `Waiting for ${partnerName} to say how it went`
      : `On for ${friendlyDate(chapter.scheduledFor)}`;
  }
  if (status === "lived") return `You and ${partnerName} lived this`;
  if (status === "declined") {
    return chapter.declinedByRole === role
      ? "You passed on this one"
      : `${partnerName} couldn’t make that one`;
  }
  return "That search came home empty-handed";
}

function ChapterCard({
  chapter,
  busy,
  notice,
  stageLabel,
  onSend,
  onAccept,
  onDecline,
  onLived,
}: {
  chapter: TogetherChapterRecord;
  busy: boolean;
  notice: string;
  stageLabel: string;
  onSend: (proposedFor: string) => void;
  onAccept: (scheduledFor: string) => void;
  onDecline: (reason: string) => void;
  onLived: () => void;
}) {
  const [dateDraft, setDateDraft] = useState(
    chapter.proposedFor || nextSaturdayIso(),
  );
  const [declining, setDeclining] = useState(false);
  const [declineDraft, setDeclineDraft] = useState("");

  const content = chapter.content;
  const anchors = chapter.brief?.anchors ?? [];

  if (chapter.status === "researching") {
    return (
      <article
        className={`${styles.card} ${styles.cardResearching}`}
        aria-busy="true"
        aria-live="polite"
      >
        <p className={styles.kicker}>With {chapter.partnerName}</p>
        <ChapterLoadingMark label={stageLabel} />
        <p className={styles.researchNote}>
          Deep research takes a few minutes. It’s looking past the obvious.
        </p>
      </article>
    );
  }

  if (!content) {
    return (
      <article className={styles.card}>
        <p className={styles.kicker}>With {chapter.partnerName}</p>
        <p className={styles.cardStatus}>{statusLine(chapter)}</p>
      </article>
    );
  }

  const answerable = chapter.status === "proposed" && chapter.role === "partner";
  const sendable = chapter.status === "draft" && chapter.role === "initiator";
  const livable = chapter.status === "accepted" && !chapter.youLived;

  return (
    <article className={styles.card}>
      <p className={styles.kicker}>With {chapter.partnerName}</p>
      <h2 className={styles.cardTitle}>{content.title}</h2>
      <p className={styles.cardStatus}>{statusLine(chapter)}</p>

      <p className={styles.invitation}>
        <AnchoredCopy text={content.invitation} anchors={anchors} />
      </p>

      <div className={styles.knownUnknown}>
        <p className={styles.knownLine}>
          <AnchoredCopy text={content.knownLine} anchors={anchors} />
        </p>
        <p className={styles.unknownLine}>{content.unknownLine}</p>
      </div>

      <div className={styles.venue}>
        <p className={styles.venueName}>{content.venueName}</p>
        <p className={styles.venueMeta}>
          {content.venueArea}
          {content.address ? ` · ${content.address}` : ""}
        </p>
        <p className={styles.venueMeta}>{content.bestTime}</p>
        {content.priceNote ? (
          <p className={styles.venueMeta}>{content.priceNote}</p>
        ) : null}
        <p className={styles.whyUncommon}>{content.whyUncommon}</p>
        {chapter.evidence && chapter.evidence.length > 0 ? (
          <p className={styles.evidence}>
            {chapter.evidence.map((link, index) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                proof {index + 1}
              </a>
            ))}
          </p>
        ) : null}
      </div>

      {sendable ? (
        <div className={styles.acceptRow}>
          <label className={styles.dateField}>
            <span>Suggest</span>
            <input
              type="date"
              value={dateDraft}
              min={todayIso()}
              onChange={(event) => setDateDraft(event.target.value)}
              aria-label="Choose a day to suggest"
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy || !dateDraft}
              onClick={() => onSend(dateDraft)}
            >
              Send to {chapter.partnerName}
            </button>
          </div>
        </div>
      ) : null}

      {answerable && !declining ? (
        <div className={styles.acceptRow}>
          <p className={styles.proposedFor}>
            {chapter.partnerName} suggested {friendlyDate(chapter.proposedFor)}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAccept(chapter.proposedFor || dateDraft)}
            >
              I’m in
            </button>
            <button
              type="button"
              className={styles.quiet}
              onClick={() => setDeclining(true)}
            >
              Can’t make it
            </button>
          </div>
        </div>
      ) : null}

      {answerable && declining ? (
        <form
          className={styles.declineForm}
          onSubmit={(event) => {
            event.preventDefault();
            onDecline(declineDraft.trim());
          }}
        >
          <input
            type="text"
            value={declineDraft}
            onChange={(event) => setDeclineDraft(event.target.value)}
            placeholder="Why not? (helps the next one)"
            aria-label="Why this one isn’t right"
            maxLength={300}
          />
          <div className={styles.actions}>
            <button type="submit" disabled={busy}>
              Send that
            </button>
            <button
              type="button"
              className={styles.quiet}
              onClick={() => setDeclining(false)}
            >
              Back
            </button>
          </div>
        </form>
      ) : null}

      {livable ? (
        <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={onLived}>
            We lived this
          </button>
        </div>
      ) : null}

      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </article>
  );
}

export default function TogetherView({ onOpenYou }: { onOpenYou: () => void }) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  /** Which card a failure belongs to, so it lands under the button pressed. */
  const [noticeFor, setNoticeFor] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [together, connections] = await Promise.all([
        loadTogether(),
        loadMyConnections(),
      ]);
      setState({ status: "ready", together, connections });
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
        const [together, connections] = await Promise.all([
          loadTogether(),
          loadMyConnections(),
        ]);
        if (active) setState({ status: "ready", together, connections });
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

  const chapters =
    state.status === "ready" ? state.together.chapters : [];
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
      chapterId: string,
      action: () => Promise<unknown>,
      failureNotice: string,
    ) => {
      setBusy(true);
      setNotice("");
      setNoticeFor(chapterId);
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

  const { accepted, pending } = state.connections;

  if (accepted.length === 0 && pending.length === 0) {
    return (
      <section className={styles.state}>
        <div className={styles.emptyOrbs} aria-hidden="true">
          <span />
          <span />
        </div>
        <h1>Invite someone you know.</h1>
        <p className={styles.stateCopy}>
          Open a person in You and send them a private link. When they accept,
          Chapter can plan something real for the two of you.
        </p>
        <button type="button" onClick={onOpenYou}>
          Find a person in You
        </button>
      </section>
    );
  }

  const openChapters = chapters.filter(isOpen);
  const pastChapters = chapters.filter((chapter) => !isOpen(chapter));
  // One open chapter per person, so the "plan something" action stays honest.
  const busyConnectionIds = new Set(
    openChapters.map((chapter) => chapter.connectionId),
  );

  return (
    <section className={styles.together}>
      <header className={styles.header}>
        <h1>
          {openChapters.length > 0
            ? "What you’re doing together."
            : "Plan something real."}
        </h1>
        <p>
          {openChapters.length > 0
            ? "One chapter at a time with each person."
            : "Chapter reads both your worlds and finds one thing neither of you would have found alone."}
        </p>
      </header>

      {openChapters.length > 0 ? (
        <div className={styles.cards}>
          {openChapters.map((chapter) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              busy={busy}
              notice={noticeFor === chapter.id ? notice : ""}
              stageLabel={RESEARCH_STAGES[stageIndex]}
              onSend={(proposedFor) =>
                void runAction(
                  chapter.id,
                  () =>
                    sendTogetherChapter(
                      chapter.id,
                      proposedFor,
                      chapter.partnerName,
                    ),
                  "Chapter couldn’t send that.",
                )
              }
              onAccept={(scheduledFor) =>
                void runAction(
                  chapter.id,
                  () =>
                    acceptTogetherChapter(
                      chapter.id,
                      scheduledFor,
                      chapter.partnerName,
                    ),
                  "Chapter couldn’t save that.",
                )
              }
              onDecline={(reason) =>
                void runAction(
                  chapter.id,
                  () =>
                    declineTogetherChapter(
                      chapter.id,
                      reason,
                      chapter.partnerName,
                    ),
                  "Chapter couldn’t record that.",
                )
              }
              onLived={() =>
                void runAction(
                  chapter.id,
                  () =>
                    markTogetherChapterLived(chapter.id, chapter.partnerName),
                  "Chapter couldn’t record that.",
                )
              }
            />
          ))}
        </div>
      ) : null}

      {accepted.length > 0 ? (
        <div className={styles.people} aria-label="Connected people">
          {accepted.map((connection) => {
            const engaged = busyConnectionIds.has(connection.id);
            return (
              <div className={styles.person} key={connection.id}>
                <span className={styles.personOrb} aria-hidden="true">
                  {initialFor(connection.name)}
                </span>
                <span className={styles.personName}>{connection.name}</span>
                <button
                  type="button"
                  className={styles.planButton}
                  disabled={busy || engaged}
                  onClick={() =>
                    void runAction(
                      connection.id,
                      () => startTogetherChapter(connection.id),
                      "Chapter couldn’t start writing.",
                    )
                  }
                >
                  {engaged ? "In progress" : "Plan something"}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {notice && !openChapters.some((chapter) => chapter.id === noticeFor) ? (
        <p className={styles.notice}>{notice}</p>
      ) : null}

      {pastChapters.length > 0 ? (
        <div className={styles.past}>
          <p>Behind you</p>
          <div>
            {pastChapters.slice(0, 6).map((chapter) => (
              <span key={chapter.id}>
                {chapter.content?.title ?? "A chapter"} · {statusLine(chapter)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className={styles.pending}>
          <p>Waiting for</p>
          <div>
            {pending.map((invite) => (
              <span key={invite.id}>{invite.name}</span>
            ))}
          </div>
        </div>
      ) : null}

      <button className={styles.addButton} type="button" onClick={onOpenYou}>
        Invite someone else
      </button>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChapterLoadingMark from "../../components/chapter-loading-mark";
import {
  createExperienceMemory,
  describeMemorySubmissionFailure,
} from "../../lib/base44Memory";
import {
  acceptNowChapter,
  declineNowChapter,
  loadNow,
  markNowChapterLived,
  nextSaturdayIso,
  NowRequestError,
  saveHomeCity,
  startNowChapter,
  type NowState,
} from "../../lib/nowClient";
import type { NowAnchor } from "../../lib/nowChapterSchema";
import { categoryOrbGradient } from "./categoryAppearance";
import type { WorldNodeCategory } from "./graphData";
import styles from "./NowView.module.css";

const POLL_INTERVAL_MS = 8_000;

const RESEARCH_STAGES = [
  "Reading your world",
  "Following one thread of it",
  "Searching where lists don’t reach",
  "Checking it’s really there",
  "Writing your chapter",
] as const;

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; now: NowState };

function orbCategory(category: string): WorldNodeCategory {
  const known: readonly string[] = [
    "experience",
    "people",
    "place",
    "activity",
    "interest",
    "feeling",
    "condition",
    "pattern",
  ];
  return (known.includes(category) ? category : "pattern") as WorldNodeCategory;
}

/**
 * Renders composed copy with the person's graph anchors as inline orb chips.
 * Anchor labels appear verbatim in the text by contract with the composer.
 */
function AnchoredCopy({
  text,
  anchors,
}: {
  text: string;
  anchors: readonly NowAnchor[];
}) {
  const parts = useMemo(() => {
    const sorted = [...anchors].sort(
      (first, second) => second.label.length - first.label.length,
    );
    let segments: Array<{ text: string; anchor?: NowAnchor }> = [{ text }];
    for (const anchor of sorted) {
      segments = segments.flatMap((segment) => {
        if (segment.anchor) return [segment];
        const pieces = segment.text.split(anchor.label);
        if (pieces.length === 1) return [segment];
        const next: Array<{ text: string; anchor?: NowAnchor }> = [];
        pieces.forEach((piece, index) => {
          if (index > 0) next.push({ text: anchor.label, anchor });
          if (piece) next.push({ text: piece });
        });
        return next;
      });
    }
    return segments;
  }, [text, anchors]);

  return (
    <>
      {parts.map((part, index) =>
        part.anchor ? (
          <span className={styles.anchor} key={`${part.text}-${index}`}>
            <span
              className={styles.anchorOrb}
              style={{
                background: categoryOrbGradient(
                  orbCategory(part.anchor.category),
                ),
              }}
              aria-hidden="true"
            />
            {part.text}
          </span>
        ) : (
          <span key={`plain-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

function todayIso() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function NowView({
  onGraphAdvanced,
}: {
  onGraphAdvanced: () => void;
}) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [dateDraft, setDateDraft] = useState(nextSaturdayIso());
  const [declining, setDeclining] = useState(false);
  const [declineDraft, setDeclineDraft] = useState("");
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const now = await loadNow();
      setState({ status: "ready", now });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof NowRequestError
            ? error.message
            : "Now couldn’t open.",
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadNow()
      .then((now) => {
        if (active) setState({ status: "ready", now });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof NowRequestError
              ? error.message
              : "Now couldn’t open.",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  const chapter =
    state.status === "ready" ? state.now.chapter : null;
  const researching = chapter?.status === "researching";

  useEffect(() => {
    if (!researching) return;

    const poll = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const stage = window.setInterval(
      () =>
        setStageIndex((index) =>
          Math.min(index + 1, RESEARCH_STAGES.length - 1),
        ),
      14_000,
    );
    pollRef.current = poll;
    return () => {
      window.clearInterval(poll);
      window.clearInterval(stage);
      pollRef.current = null;
    };
  }, [researching, refresh]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, failureNotice: string) => {
      setBusy(true);
      setNotice("");
      try {
        await action();
        await refresh();
      } catch (error) {
        setNotice(
          error instanceof NowRequestError ? error.message : failureNotice,
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
        <ChapterLoadingMark label="Opening Now" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.stateScreen}>
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

  const { now } = state;

  if (!now.homeCity) {
    return (
      <section className={styles.stateScreen}>
        <h1>Where does your life happen right now?</h1>
        <p className={styles.stateCopy}>
          Chapter proposes real experiences, so it needs to know your city.
        </p>
        <form
          className={styles.cityForm}
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(
              () => saveHomeCity(cityDraft),
              "Chapter couldn’t save that city.",
            );
          }}
        >
          <input
            type="text"
            value={cityDraft}
            onChange={(event) => setCityDraft(event.target.value)}
            placeholder="Seoul"
            aria-label="Your city"
            maxLength={80}
          />
          <button type="submit" disabled={busy || cityDraft.trim().length < 2}>
            That’s home for now
          </button>
        </form>
        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </section>
    );
  }

  if (!chapter || ["declined", "lived", "failed"].includes(chapter.status)) {
    return (
      <section className={styles.stateScreen}>
        <h1>One chapter at a time.</h1>
        <p className={styles.stateCopy}>
          {chapter?.status === "declined"
            ? "Understood. Chapter will take a different angle on the next one."
            : chapter?.status === "lived"
              ? "That one’s part of your world now. Ready when you are."
              : chapter?.status === "failed"
                ? "The last search came home empty-handed. Rare, but it happens."
                : `Chapter reads your world, then goes looking for one real, uncommon experience in ${now.homeCity} — something that grew out of your memories, with one step into the unknown.`}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void runAction(
              () => startNowChapter(),
              "Chapter couldn’t start writing.",
            )
          }
        >
          Write my next chapter
        </button>
        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </section>
    );
  }

  if (chapter.status === "researching") {
    return (
      <div className={styles.researching} aria-busy="true" aria-live="polite">
        <ChapterLoadingMark label={RESEARCH_STAGES[stageIndex]} />
        <p className={styles.researchNote}>
          Deep research takes a few minutes. It’s looking past the obvious.
        </p>
      </div>
    );
  }

  const content = chapter.content;
  const anchors = chapter.brief?.anchors ?? [];
  if (!content) {
    return (
      <section className={styles.stateScreen}>
        <h1>This chapter went missing.</h1>
        <button type="button" onClick={() => void refresh()}>
          Reload
        </button>
      </section>
    );
  }

  if (chapter.status === "proposed") {
    return (
      <section className={styles.chapterScreen}>
        <article className={styles.card}>
          <p className={styles.kicker}>Your next chapter</p>
          <h1>{content.title}</h1>
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

          {declining ? (
            <form
              className={styles.declineForm}
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(
                  () => declineNowChapter(chapter.id, declineDraft.trim()),
                  "Chapter couldn’t record that.",
                );
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
                  Not this one
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
          ) : (
            <div className={styles.acceptRow}>
              <label className={styles.dateField}>
                <span>When</span>
                <input
                  type="date"
                  value={dateDraft}
                  min={todayIso()}
                  onChange={(event) => setDateDraft(event.target.value)}
                  aria-label="Choose a day"
                />
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={busy || !dateDraft}
                  onClick={() =>
                    void runAction(
                      () => acceptNowChapter(chapter.id, dateDraft),
                      "Chapter couldn’t save your plan.",
                    )
                  }
                >
                  I’m going
                </button>
                <button
                  type="button"
                  className={styles.quiet}
                  disabled={busy}
                  onClick={() => setDeclining(true)}
                >
                  Not this one
                </button>
              </div>
            </div>
          )}
          {notice ? <p className={styles.notice}>{notice}</p> : null}
        </article>
      </section>
    );
  }

  // Accepted: the plan, then the reflection loop once the day has passed.
  const dayArrived =
    Boolean(chapter.scheduledFor) && chapter.scheduledFor! <= todayIso();

  return (
    <section className={styles.chapterScreen}>
      <article className={styles.card}>
        <p className={styles.kicker}>
          {dayArrived ? "How was it?" : "Your plan"}
        </p>
        <h1>{content.title}</h1>
        <p className={styles.venueName}>{content.venueName}</p>
        <p className={styles.venueMeta}>
          {content.venueArea} · {chapter.scheduledFor}
        </p>
        <p className={styles.venueMeta}>{content.bestTime}</p>

        {dayArrived ? (
          <form
            className={styles.reflectionForm}
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(async () => {
                try {
                  await createExperienceMemory({
                    clientRequestId: `now-${chapter.id}`,
                    source: "reflection",
                    text: reflectionDraft.trim(),
                    images: [],
                  });
                } catch (error) {
                  throw new NowRequestError(
                    describeMemorySubmissionFailure(error).message,
                    "NOW_REFLECTION_FAILED",
                    502,
                  );
                }
                await markNowChapterLived(chapter.id);
                onGraphAdvanced();
              }, "Chapter couldn’t keep that memory.");
            }}
          >
            <textarea
              value={reflectionDraft}
              onChange={(event) => setReflectionDraft(event.target.value)}
              placeholder="What happened? Who was there? What stayed with you?"
              aria-label="Tell Chapter how it went"
              rows={5}
              maxLength={4000}
            />
            <div className={styles.actions}>
              <button
                type="submit"
                disabled={busy || reflectionDraft.trim().length < 12}
              >
                Add it to my world
              </button>
              <button
                type="button"
                className={styles.quiet}
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => markNowChapterLived(chapter.id),
                    "Chapter couldn’t close that chapter.",
                  )
                }
              >
                Skip
              </button>
            </div>
          </form>
        ) : (
          <p className={styles.stateCopy}>
            When the day passes, Chapter will ask how it went — and that story
            joins your world.
          </p>
        )}
        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </article>
    </section>
  );
}

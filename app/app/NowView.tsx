"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AgentOrbVideo from "../../components/landing/agent-orb-video";
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
  searchPlaceSuggestions,
  type PlaceSuggestion,
  startNowChapter,
  type NowState,
} from "../../lib/nowClient";
import type { NowAnchor } from "../../lib/nowChapterSchema";
import { lastOpened, OPENED_NOW } from "../../lib/openedViews";
import { categoryOrbGradient } from "./categoryAppearance";
import type { WorldNodeCategory } from "./graphData";
import placeholderLocationImage from "../assets/mojiko-waterfront.jpg";
import styles from "./NowView.module.css";

/**
 * A research run takes minutes, and the backend answers 429 when asked too
 * often, so the reads a person is actually waiting on come first.
 */
const POLL_INTERVAL_MS = 15_000;

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

/**
 * The home-city ask: an open line to write on rather than a box, with
 * type-ahead places beneath it and the commit button last.
 *
 * One question, answered by one pick — a whole city is accepted as it stands.
 * Deep research does better with somewhere walkable, so a city sets the centre
 * of the next lookup and invites a neighbourhood without demanding one.
 */
function HomeCityAsk({
  busy,
  notice,
  onSubmit,
}: {
  busy: boolean;
  notice: string;
  onSubmit: (homeCity: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [chosen, setChosen] = useState<PlaceSuggestion | null>(null);
  const [narrowing, setNarrowing] = useState<PlaceSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const settled = chosen !== null && draft.trim() === chosen.label;
  const homeCity = draft.trim().length >= 2 ? draft.trim() : (chosen?.label ?? "");

  useEffect(() => {
    if (settled || draft.trim().length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchPlaceSuggestions(draft, {
        near: narrowing
          ? { latitude: narrowing.latitude, longitude: narrowing.longitude }
          : undefined,
        signal: controller.signal,
      })
        .then((places) => {
          setSuggestions(places);
          setActiveIndex(-1);
        })
        .catch(() => {
          /* An aborted or failed lookup just leaves the last list in place. */
        });
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [draft, narrowing, settled]);

  // The list scrolls inside itself, so arrowing past its edge has to follow.
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`home-city-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function choose(place: PlaceSuggestion) {
    setSuggestions([]);
    setActiveIndex(-1);
    setChosen(place);
    setDraft(place.label);
    // A whole city is a complete answer — the ask is one question. But hold it
    // as the centre of the next lookup, so anyone who does keep typing gets
    // Gangnam rather than a Gang on the other side of the world.
    setNarrowing(place.broad ? place : null);
    inputRef.current?.focus();
  }

  return (
    <form
      className={styles.cityForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (homeCity.length >= 2) onSubmit(homeCity);
      }}
    >
      <div className={styles.cityField}>
        <input
          ref={inputRef}
          className={styles.cityInput}
          type="text"
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            if (chosen && !narrowing) setChosen(null);
            if (value.trim().length < 2) {
              setSuggestions([]);
              setActiveIndex(-1);
            }
          }}
          onKeyDown={(event) => {
            if (suggestions.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % suggestions.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) =>
                index <= 0 ? suggestions.length - 1 : index - 1,
              );
            } else if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              choose(suggestions[activeIndex]);
            } else if (event.key === "Escape") {
              setSuggestions([]);
              setActiveIndex(-1);
            }
          }}
          /* The example is the instruction: a neighbourhood, then the city. */
          placeholder={narrowing ? "Bangbae-dong" : "Bangbae-dong, Seoul"}
          aria-label="Where you live"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={80}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="home-city-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `home-city-option-${activeIndex}` : undefined
          }
        />
        <span className={styles.cityRule} aria-hidden="true" />
      </div>

      <p className={styles.cityHint} aria-live="polite">
        {narrowing
          ? `${narrowing.name} works. A neighbourhood gives Chapter more to go on.`
          : ""}
      </p>

      <ul
        className={styles.suggestions}
        id="home-city-suggestions"
        role="listbox"
        aria-label="Places"
      >
        {suggestions.map((place, index) => (
          <li key={place.id}>
            <button
              type="button"
              id={`home-city-option-${index}`}
              className={styles.suggestion}
              role="option"
              aria-selected={index === activeIndex}
              data-active={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(place)}
            >
              <span className={styles.suggestionName}>{place.name}</span>
              {place.context ? (
                <span className={styles.suggestionContext}>{place.context}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <button type="submit" disabled={busy || homeCity.length < 2}>
        That’s home for now
      </button>
      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </form>
  );
}

/**
 * Where Now is currently looking: a card in the corner, cut from the same
 * cloth as the landing stack — white, hairline ring, soft lift — and the way
 * in to changing it. Shows the neighbourhood alone; the city and country ride
 * along on the title.
 */
function HomeCityCard({
  homeCity,
  notice,
  onChange,
}: {
  homeCity: string;
  notice: string;
  /** Resolves true once the new place is saved, which closes the dialog. */
  onChange: (homeCity: string) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  // Counts visits rather than tracking openness: <dialog> already knows whether
  // it's open, and Escape closes it without telling React. Mirroring that in
  // state only creates a way for the two to disagree and strand the card shut.
  const [visit, setVisit] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const near = homeCity.split(",")[0].trim() || homeCity;

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setVisit((count) => count + 1);
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        className={styles.homeCard}
        onClick={openDialog}
        title={homeCity}
        aria-label={`Now is looking in ${homeCity}. Change it.`}
      >
        <span className={styles.homeCardHeader}>
          <span
            className={styles.homeCardOrb}
            style={{ background: categoryOrbGradient("place") }}
            aria-hidden="true"
          />
          <span className={styles.homeCardName}>{near}</span>
          <span className={styles.homeCardAction} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
            </svg>
          </span>
        </span>
        <span className={styles.homeCardImage}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={placeholderLocationImage.src}
            alt=""
            draggable={false}
            className={styles.homeCardImageImg}
          />
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.homeDialog}
        onClick={(event) => {
          // Clicks land on the dialog itself only when they miss the panel.
          if (event.target === dialogRef.current) closeDialog();
        }}
      >
        <div className={styles.homeDialogPanel}>
          <h2>Where does your life happen now?</h2>
          <p className={styles.homeDialogNow}>
            Currently <strong>{homeCity}</strong>
          </p>
          {/* Keyed on the visit, so each opening starts on a blank line. */}
          <HomeCityAsk
            key={visit}
            busy={saving}
            notice={notice}
            onSubmit={(next) => {
              setSaving(true);
              void onChange(next)
                .then((saved) => {
                  if (saved) closeDialog();
                })
                .finally(() => setSaving(false));
            }}
          />
          <button
            type="button"
            className={styles.homeDialogClose}
            onClick={closeDialog}
          >
            Keep {near}
          </button>
        </div>
      </dialog>
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
  /**
   * Now unmounts when you leave the tab, so without this every return trip
   * pays for the read again and opens on a spinner. What it last said is put
   * back straight away and re-read behind you.
   */
  const opened = lastOpened<NowState>(OPENED_NOW);
  const [state, setState] = useState<ViewState>(
    opened ? { status: "ready", now: opened } : { status: "loading" },
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
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
      // A tab that is already standing stays standing. Only a Now that never
      // opened is allowed to say it couldn't.
      setState((current) =>
        current.status === "ready"
          ? current
          : {
              status: "error",
              message:
                error instanceof NowRequestError
                  ? error.message
                  : "Now couldn’t open.",
            },
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) await refresh();
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const chapter =
    state.status === "ready" ? state.now.chapter : null;
  const researching = chapter?.status === "researching";

  useEffect(() => {
    if (!researching) return;

    // Only while someone is there to see it land: a poll behind a hidden tab
    // is load spent on nobody, which the visible reads then compete with.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_INTERVAL_MS);
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

  /** Like runAction, but the caller needs to know whether it took. */
  const changeHomeCity = useCallback(
    async (homeCity: string) => {
      setNotice("");
      try {
        await saveHomeCity(homeCity);
        await refresh();
        return true;
      } catch (error) {
        setNotice(
          error instanceof NowRequestError
            ? error.message
            : "Chapter couldn’t save that place.",
        );
        return false;
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
      <section className={styles.cityScreen}>
        <div className={styles.cityPrompt}>
          <span className={styles.cityOrb} aria-hidden="true">
            <AgentOrbVideo
              src="/you-agent-orb.mp4"
              poster="/you-agent-orb-poster.jpg"
            />
          </span>
          <h1>Where does your life happen right now?</h1>
          <HomeCityAsk
            busy={busy}
            notice={notice}
            onSubmit={(homeCity) =>
              void runAction(
                () => saveHomeCity(homeCity),
                "Chapter couldn’t save that city.",
              )
            }
          />
        </div>
      </section>
    );
  }

  // Every screen past the ask carries the corner card, whatever it's showing.
  const withHomeCard = (screen: ReactNode) => (
    <>
      <HomeCityCard
        homeCity={now.homeCity}
        notice={notice}
        onChange={changeHomeCity}
      />
      {screen}
    </>
  );

  if (!chapter || ["declined", "lived", "failed"].includes(chapter.status)) {
    return withHomeCard(
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
      </section>,
    );
  }

  if (chapter.status === "researching") {
    return withHomeCard(
      <div className={styles.researching} aria-busy="true" aria-live="polite">
        <ChapterLoadingMark label={RESEARCH_STAGES[stageIndex]} />
        <p className={styles.researchNote}>
          Deep research takes a few minutes. It’s looking past the obvious.
        </p>
      </div>,
    );
  }

  const content = chapter.content;
  const anchors = chapter.brief?.anchors ?? [];
  if (!content) {
    return withHomeCard(
      <section className={styles.stateScreen}>
        <h1>This chapter went missing.</h1>
        <button type="button" onClick={() => void refresh()}>
          Reload
        </button>
      </section>,
    );
  }

  if (chapter.status === "proposed") {
    return withHomeCard(
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
      </section>,
    );
  }

  // Accepted: the plan, then the reflection loop once the day has passed.
  const dayArrived =
    Boolean(chapter.scheduledFor) && chapter.scheduledFor! <= todayIso();

  return withHomeCard(
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
    </section>,
  );
}

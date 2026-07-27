"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  NowRequestError,
  saveHomeCity,
  saveNowPreferences,
  searchPlaceSuggestions,
  type PlaceSuggestion,
  startNowChapter,
  type NowState,
} from "../../lib/nowClient";
import {
  type NowAnchor,
  NOW_DEFAULT_REACH,
  NOW_DEFAULT_WINDOW,
  type NowEvidenceLink,
  NOW_REACH,
  NOW_REACHES,
  NOW_TIME_WINDOW_HOURS,
  NOW_TIME_WINDOWS,
  type NowReach,
  type NowTimeWindow,
} from "../../lib/nowChapterSchema";
import {
  addDays,
  comingWeekend,
  daysBetween,
  describeWindows,
  formatDay,
  formatWeekday,
  isoDay,
  sortWindows,
  upcomingDays,
} from "../../lib/nowSchedule";
import { lastOpened, OPENED_NOW } from "../../lib/openedViews";
import { categoryOrbGradient } from "./categoryAppearance";
import type { WorldNodeCategory } from "./graphData";
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

/**
 * The four windows read as one arc of a day: gold at the top of it, through
 * the long amber of an afternoon, into dusk and then out the other side. Chapter
 * already speaks in orbs, so an hour of the day gets to be one too.
 */
const WINDOW_ORB: Record<NowTimeWindow, string> = {
  morning: "radial-gradient(circle at 32% 28%, #fffaea, #f8d27c 60%, #e3b451)",
  afternoon: "radial-gradient(circle at 32% 28%, #ffdba4, #ee9145 60%, #cd662a)",
  evening: "radial-gradient(circle at 32% 28%, #f3bccb, #b077b8 60%, #7a5aa6)",
  night: "radial-gradient(circle at 32% 28%, #9fadde, #45508c 60%, #262b5c)",
};

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
 * Where you live: an open line to write on rather than a box, with type-ahead
 * places beneath it.
 *
 * One question, answered by one pick — a whole city is accepted as it stands.
 * Deep research does better with somewhere walkable, so a city sets the centre
 * of the next lookup and invites a neighbourhood without demanding one.
 *
 * Renders as a fragment so whatever holds it decides the layout: it is the
 * whole of the first-run screen and one row of the settings sheet, and those
 * two want different room around it.
 */
function HomeCityField({
  initial = "",
  onChange,
}: {
  initial?: string;
  /** Called with the city as it stands, "" while it is not yet an answer. */
  onChange: (homeCity: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
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

  // Whatever is holding this decides what a city is worth: the first-run
  // screen waits for a button, the settings sheet folds it in with the rest.
  useEffect(() => {
    onChange(homeCity);
  }, [homeCity, onChange]);

  return (
    <>
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
    </>
  );
}

/** The first-run screen: the one question, and a button to answer it with. */
function HomeCityAsk({
  busy,
  notice,
  onSubmit,
}: {
  busy: boolean;
  notice: string;
  onSubmit: (homeCity: string) => void;
}) {
  const [homeCity, setHomeCity] = useState("");

  return (
    <form
      className={styles.cityForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (homeCity.length >= 2) onSubmit(homeCity);
      }}
    >
      <HomeCityField onChange={setHomeCity} />
      <button type="submit" disabled={busy || homeCity.length < 2}>
        That’s home for now
      </button>
      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </form>
  );
}

/** How far ahead the rail runs before it has to stretch for a chosen day. */
const RAIL_DAYS = 21;

/**
 * A rail of real days rather than a date field.
 *
 * Picking a Saturday three weeks out should feel like pointing at it on a
 * calendar, and a day you can see the weekday of is a day you can tell the
 * truth about being free on.
 *
 * It appears twice, for the two moments a day is worth asking about: setting
 * one aside before there is anything to do on it, and answering "when are you
 * going" once there is. The second is the honest one, so it gets the shorter
 * horizon — nobody accepts a chapter for eleven weeks from now.
 */
function DayRail({
  day,
  label,
  span = RAIL_DAYS,
  onChange,
}: {
  day: string;
  label: string;
  /** How far ahead the rail runs before a chosen day stretches it. */
  span?: number;
  onChange: (day: string) => void;
}) {
  const today = useMemo(() => isoDay(), []);
  const railRef = useRef<HTMLDivElement>(null);

  // Normally runs its span, and stretches only as far as it must to keep a
  // day that was already chosen inside it.
  const days = useMemo(() => {
    const reach = day ? daysBetween(today, day) + 3 : 0;
    return upcomingDays(Math.max(span, reach), today);
  }, [day, span, today]);

  // A day chosen weeks ago opens under the thumb rather than off the edge.
  // Deferred a frame because this can mount before the dialog around it is
  // shown, and nothing can be scrolled into a view that has no layout yet.
  useEffect(() => {
    if (!day) return;
    const frame = requestAnimationFrame(() => {
      railRef.current
        ?.querySelector(`[data-day="${day}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "center" });
    });
    return () => cancelAnimationFrame(frame);
    // Only on the way in: re-centring on every tap fights the person scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={styles.dayRail}
      ref={railRef}
      role="radiogroup"
      aria-label={label}
    >
      {days.map((entry) => (
        <button
          type="button"
          key={entry.iso}
          data-day={entry.iso}
          className={styles.dayTile}
          data-chosen={entry.iso === day}
          role="radio"
          aria-checked={entry.iso === day}
          onClick={() => onChange(entry.iso)}
        >
          <span className={styles.dayWeekday}>{entry.weekday}</span>
          <span className={styles.dayNumber}>{entry.dayOfMonth}</span>
          {/* The month is named where one turns, and on whichever day is
              chosen, so the answer never depends on scrolling back. */}
          <span className={styles.dayMonth}>
            {entry.startsMonth || entry.iso === day ? entry.month : ""}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Where the find came from, named.
 *
 * Minutes of live research reduced to "proof 1" reads like a footnote on a
 * generated paragraph. A source carrying its own name reads like somewhere
 * someone actually went and looked.
 */
function sourceLabel(link: NowEvidenceLink) {
  const title = link.title?.trim();
  if (title) return title;
  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function Sources({ links }: { links: readonly NowEvidenceLink[] }) {
  if (links.length === 0) return null;
  return (
    <p className={styles.sources}>
      <span className={styles.sourcesLabel}>Checked against</span>
      {links.map((link) => (
        <a
          key={link.url}
          className={styles.source}
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {sourceLabel(link)}
        </a>
      ))}
    </p>
  );
}

/**
 * The day and hours Chapter would write for, as they read inside a sentence:
 * "Saturday evening", "this evening", "all day Sunday".
 *
 * The resting screen never says this out loud. The card already carries it,
 * and the orb only has to be pressed.
 */
function offerPhrase(
  day: string,
  windows: readonly NowTimeWindow[],
  today: string,
) {
  const hours = describeWindows(windows).toLowerCase();
  const when =
    day === today
      ? "this"
      : day === addDays(today, 1)
        ? "tomorrow"
        : formatWeekday(day);
  if (hours === "all day") {
    return `all day ${day === today ? "today" : when}`;
  }
  return `${when} ${hours}`;
}

/**
 * How far you'll go, as four stops rather than a dial.
 *
 * A real range input rather than a row of buttons: it drags, it takes arrow
 * keys for free, and the stops are what stop it landing between two answers
 * the research could not tell apart anyway.
 */
function ReachSlider({
  reach,
  onChange,
}: {
  reach: NowReach;
  onChange: (reach: NowReach) => void;
}) {
  const index = NOW_REACHES.indexOf(reach);
  const detail = NOW_REACH[reach];

  return (
    <div className={styles.reach}>
      <p className={styles.reachHead}>
        <span className={styles.reachLabel}>How far you’ll go</span>
        <span className={styles.reachValue}>{detail.label}</span>
      </p>

      <span className={styles.reachTrack}>
        {/* Under the input, so the thumb rides over its own stops. */}
        <span className={styles.reachStops} aria-hidden="true">
          {NOW_REACHES.map((stop, stopIndex) => (
            <span
              key={stop}
              className={styles.reachStop}
              data-passed={stopIndex <= index}
            />
          ))}
        </span>
        <input
          type="range"
          className={styles.reachRange}
          min={0}
          max={NOW_REACHES.length - 1}
          step={1}
          value={index}
          onChange={(event) =>
            onChange(NOW_REACHES[Number(event.target.value)])
          }
          aria-label="How far you’ll go"
          aria-valuetext={`${detail.label}. ${detail.note}.`}
        />
      </span>

      <p className={styles.reachNote} aria-live="polite">
        {detail.note}
      </p>
    </div>
  );
}

/**
 * Everything Chapter works from: where you live, when you are usually free,
 * and how far you will go. Three standing facts about a person, not a plan.
 *
 * There is no day in here. A day is a thing you commit to, and nobody commits
 * to one for a chapter they have not read yet, so that question waits until
 * there is something worth answering it about.
 *
 * Nothing in here is a gate either. Every row already has an answer before the
 * sheet opens, because the orb behind it is busy offering to write from those
 * answers. This is where someone comes to correct one.
 */
function AgentSettingsForm({
  busy,
  notice,
  homeCity,
  windows,
  reach,
  onChangeHomeCity,
  onToggleWindow,
  onChangeReach,
  onSubmit,
  children,
}: {
  busy: boolean;
  notice: string;
  homeCity: string;
  windows: readonly NowTimeWindow[];
  reach: NowReach;
  onChangeHomeCity: (homeCity: string) => void;
  onChangeReach: (reach: NowReach) => void;
  /**
   * A toggle rather than a new list: two taps inside one frame would both be
   * answering the same stale set, and the second would undo the first.
   */
  onToggleWindow: (window: NowTimeWindow) => void;
  onSubmit: () => void;
  /** Whatever sits under the save. */
  children?: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyScrolls, setBodyScrolls] = useState(false);

  /*
   * Whether the settings run past the bottom of the window they are in. Only
   * then does the fade at the foot mean anything: on a tall screen it would
   * just be dimming the last row for no reason.
   */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const check = () =>
      setBodyScrolls(body.scrollHeight > body.clientHeight + 1);
    check();
    // The children too, because a list of places opening is what most often
    // turns a sheet that fitted into one that does not.
    const observer = new ResizeObserver(check);
    observer.observe(body);
    for (const child of Array.from(body.children)) observer.observe(child);
    return () => observer.disconnect();
  }, []);

  // A day with no hours in it is not an answer the research can use, so the
  // one thing this form insists on is that at least one part of a day stands.
  const ready = homeCity.length >= 2 && windows.length > 0;

  return (
    <form
      className={styles.sheetForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !busy) onSubmit();
      }}
    >
      <div
        className={styles.sheetBody}
        ref={bodyRef}
        data-scrolls={bodyScrolls}
      >
      <p className={styles.sheetLabel}>Where you are</p>
      <HomeCityField initial={homeCity} onChange={onChangeHomeCity} />

      <p className={styles.sheetLabel}>When you’re usually free</p>

      <ul className={styles.windowList}>
        {NOW_TIME_WINDOWS.map((window) => {
          const chosen = windows.includes(window);
          return (
            <li key={window}>
              <button
                type="button"
                className={styles.window}
                data-chosen={chosen}
                aria-pressed={chosen}
                onClick={() => onToggleWindow(window)}
              >
                <span
                  className={styles.windowOrb}
                  style={{ background: WINDOW_ORB[window] }}
                  aria-hidden="true"
                />
                <span className={styles.windowText}>
                  <span className={styles.windowName}>{window}</span>
                  <span className={styles.windowHours}>
                    {NOW_TIME_WINDOW_HOURS[window]}
                  </span>
                </span>
                <span className={styles.windowCheck} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="m5 12.5 4.5 4.5L19 7"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <ReachSlider reach={reach} onChange={onChangeReach} />
      </div>

      <div className={styles.sheetFoot}>
        <button type="submit" disabled={busy || !ready}>
          Save
        </button>
        {children}
        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </div>
    </form>
  );
}

/**
 * The sheet in a modal. Controlled rather than imperative: Escape closes a
 * <dialog> without telling React, so the close event is wired back to the
 * state that opened it and the two cannot end up disagreeing.
 */
function SettingsDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.homeDialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {/* Built on opening rather than kept in the wings, so each visit starts
          from what is true now and the form has a layout to measure. */}
      {open ? <div className={styles.homeDialogPanel}>{children}</div> : null}
    </dialog>
  );
}

/**
 * The way in to everything Chapter works from.
 *
 * There used to be a card here holding all of it on screen at once: city, day,
 * hours, reach, a row each, with a pencil in the corner. It was accurate and
 * it was the wrong object. Four labelled rows and an edit button is the shape
 * of a thing you administer, and this is not a thing you administer. It is a
 * thing you press.
 *
 * So the panel is gone and this is what is left of it: one mark, held at the
 * edge of the page and nearly invisible until somebody reaches for it. What
 * used to be its rows now lives in the sheet it opens, and what used to be its
 * status line is said out loud under the orb, on the occasions there is
 * anything to say.
 */
function SettingsEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className={styles.settingsEntry}
      onClick={onOpen}
      aria-label="Edit what Chapter works from"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
      </svg>
    </button>
  );
}

/**
 * The middle of the tab, which is the agent itself.
 *
 * At rest there is nothing here but the orb, turning. No headline, no copy,
 * no buttons: everything you could tell it lives in the card, so the screen
 * has nothing to be except the thing you are talking to.
 *
 * When there is something to be asked for, the orb is what you ask. It is the
 * only control on the screen, and it says nothing about itself: what it would
 * write for is already sitting in the card, so the press can stay a press. The
 * hint underneath surfaces on approach and is gone again at rest, which is the
 * whole of the compromise between bare and unguessable.
 *
 * When Chapter has actually written something the same orb comes down to the
 * size of a thing that is speaking, moves up beside its own headline, and the
 * chapter opens underneath it. One element, two states, laid out by Motion so
 * it travels rather than cutting.
 */
function NowStage({
  headline,
  note,
  press,
  children,
}: {
  /** Present only when there is a chapter. Its arrival is what opens the stage. */
  headline?: string;
  /** A quiet line under the resting orb, for when it is busy thinking. */
  note?: string;
  /** Makes the orb the one thing on this screen that can be pressed. */
  press?: { onPress: () => void; busy: boolean; label: string; hint: string };
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const open = Boolean(headline);
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, bounce: 0, duration: 0.68 };

  const orb = (
    <motion.span
      className={styles.stageOrb}
      layout
      layoutDependency={open}
      transition={layoutTransition}
    >
      {/*
        Plays regardless. The orb decides for itself whether it is on
        screen by watching its nearest <main>, and in this tab that check
        can answer no forever, leaving it sat on its poster.
      */}
      <AgentOrbVideo playWhileMounted preload="auto" />
    </motion.span>
  );

  return (
    <section className={styles.stage} data-open={open}>
      <div className={styles.stageHead}>
        {press ? (
          <>
            <button
              type="button"
              className={styles.orbPress}
              onClick={press.onPress}
              disabled={press.busy}
              aria-label={press.label}
            >
              {orb}
            </button>
            {/* Sibling rather than child, so the target stays the orb and
                hovering the words does not count as reaching for it. */}
            <span className={styles.orbHint} aria-hidden="true">
              {press.hint}
            </span>
          </>
        ) : (
          orb
        )}

        {headline ? (
          <motion.h1
            className={styles.stageHeadline}
            layout="position"
            layoutDependency={open}
            transition={layoutTransition}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={headline}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0.12 : 0.34,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {headline}
              </motion.span>
            </AnimatePresence>
          </motion.h1>
        ) : null}
      </div>

      {note ? (
        <p className={styles.stageNote} aria-live="polite">
          {note}
        </p>
      ) : null}

      {/*
        The entrance is a CSS keyframe, not a Motion animate. A chapter that
        has been written is the whole point of the screen, and an element that
        starts at opacity 0 and waits for JavaScript to raise it is one paused
        frameloop away from being invisible. CSS lands on its final frame on
        its own.
      */}
      {children ? <div className={styles.stageBody}>{children}</div> : null}
    </section>
  );
}

export default function NowView({
  onGraphAdvanced,
  onOpenYou,
}: {
  onGraphAdvanced: () => void;
  /** Somewhere to send a person whose world just grew, to go and see it. */
  onOpenYou: () => void;
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
  const [dateDraft, setDateDraft] = useState(comingWeekend());
  const [declining, setDeclining] = useState(false);
  const [declineDraft, setDeclineDraft] = useState("");
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  /**
   * A chapter that has just become a memory. The record is already `lived`, so
   * without this the screen would drop straight back to offering another one,
   * and the thing that makes the whole loop worth running — a world that is
   * bigger than it was this morning — would happen off screen.
   */
  const [justLived, setJustLived] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cityDraft, setCityDraft] = useState("");
  const [windowDraft, setWindowDraft] = useState<NowTimeWindow[]>([]);
  const [reachDraft, setReachDraft] = useState<NowReach>(NOW_DEFAULT_REACH);
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

  /*
   * A chapter written for a day already set aside arrives with its date, so
   * saying yes is one press rather than a question already answered. One
   * written on the spot still opens on the next Saturday.
   */
  const scheduledFor = chapter?.scheduledFor;
  useEffect(() => {
    if (scheduledFor) setDateDraft(scheduledFor);
  }, [scheduledFor]);

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

  /**
   * Opens the sheet on what is already true, so changing your mind about
   * Saturday evening starts from Saturday evening rather than from nothing.
   */
  const openSettings = useCallback(() => {
    const now = state.status === "ready" ? state.now : null;
    setNotice("");
    setCityDraft(now?.homeCity ?? "");
    setWindowDraft([...(now?.timeWindows ?? [NOW_DEFAULT_WINDOW])]);
    setReachDraft(now?.reach ?? NOW_DEFAULT_REACH);
    setEditing(true);
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className={styles.loading} aria-busy="true">
        <ChapterLoadingMark label="Opening Now" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <NowStage headline={state.message}>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              void refresh();
            }}
          >
            Try again
          </button>
        </div>
      </NowStage>
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

  const today = isoDay();

  /*
   * What the orb would write for if pressed this second, as it reads on screen.
   *
   * Only ever said in the hover hint: the server reads the real thing off the
   * account when the press arrives, so this is a description of what will
   * happen rather than the instruction that makes it happen. There is always
   * an answer, which is the whole design — nobody has to fill anything in to
   * be handed a chapter.
   *
   * A day claimed by an older build of this app still wins, on the few
   * accounts that have one. Nothing can create another.
   */
  const offerDay =
    chapter?.status === "scheduled" && chapter.scheduledFor
      ? chapter.scheduledFor
      : comingWeekend(today);
  const offerWindows: readonly NowTimeWindow[] = now.timeWindows?.length
    ? now.timeWindows
    : [NOW_DEFAULT_WINDOW];

  const idle =
    !chapter ||
    ["declined", "lived", "failed", "scheduled"].includes(chapter.status);

  /** One press, from wherever it is offered. */
  const writeOne = () =>
    void runAction(async () => {
      await startNowChapter();
      setEditing(false);
    }, "Chapter couldn’t start writing.");

  /*
   * The one mark and its sheet stand over every screen past the first-run ask.
   * There is one way in to all of it, and this is it.
   */
  const shell = (screen: ReactNode) => (
    <>
      <SettingsEntry onOpen={openSettings} />

      <SettingsDialog open={editing} onClose={() => setEditing(false)}>
        <h2>Chapter</h2>
        <p className={styles.sheetIntro}>Everything it works from.</p>
        <AgentSettingsForm
          busy={busy}
          notice={notice}
          homeCity={cityDraft}
          windows={windowDraft}
          reach={reachDraft}
          onChangeHomeCity={setCityDraft}
          onChangeReach={setReachDraft}
          onToggleWindow={(window) =>
            setWindowDraft((chosen) =>
              sortWindows(
                chosen.includes(window)
                  ? chosen.filter((entry) => entry !== window)
                  : [...chosen, window],
              ),
            )
          }
          onSubmit={() =>
            void runAction(async () => {
              if (cityDraft.length >= 2 && cityDraft !== now.homeCity) {
                await saveHomeCity(cityDraft);
              }
              const moved =
                windowDraft.join(",") !== (now.timeWindows ?? []).join(",") ||
                reachDraft !== now.reach;
              if (moved) await saveNowPreferences(windowDraft, reachDraft);
              setEditing(false);
            }, "Chapter couldn’t save that.")
          }
        >
          <div className={styles.sheetActions}>
            <button
              type="button"
              className={styles.quiet}
              onClick={() => setEditing(false)}
            >
              Close
            </button>
          </div>
        </AgentSettingsForm>
      </SettingsDialog>

      {screen}
    </>
  );

  /*
   * A chapter that has just become a memory.
   *
   * The record is already `lived` and the screen would otherwise drop straight
   * back to offering another one. This is the only place the loop is visible
   * from: you went, and the world Chapter reads from is bigger for it.
   */
  if (justLived) {
    return shell(
      <NowStage>
        <div className={styles.offer}>
          <p className={styles.offerAsk}>That’s in your world now.</p>
          <p className={styles.offerNote}>
            What happened is part of what Chapter knows about you. The next
            chapter starts from here.
          </p>
          <div className={styles.offerActions}>
            <button
              type="button"
              onClick={() => {
                setJustLived(false);
                onOpenYou();
              }}
            >
              See what grew
            </button>
            <button
              type="button"
              className={styles.plain}
              onClick={() => setJustLived(false)}
            >
              Stay here
            </button>
          </div>
        </div>
      </NowStage>,
    );
  }

  /*
   * The resting screen, which is where most visits start and end: the orb, and
   * nothing else. Press it and Chapter goes and writes one.
   *
   * The one line underneath exists only when there is something a person could
   * not otherwise know. Being ready is not news, so most of the time there is
   * no line at all.
   */
  if (idle) {
    const phrase = offerPhrase(offerDay, offerWindows, today);
    return shell(
      <NowStage
        press={{
          onPress: writeOne,
          busy,
          label: `Write me a chapter for ${phrase}`,
          hint: `Write me one for ${phrase}`,
        }}
        note={
          busy
            ? // Between the press and the first research stage a model is
              // reading a whole world. Said out loud, because a bare screen
              // that has just been pressed and does nothing looks broken.
              "Reading your world"
            : chapter?.status === "failed"
              ? "The last search came home empty."
              : undefined
        }
      >
        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </NowStage>,
    );
  }

  if (chapter.status === "researching") {
    return shell(
      <NowStage note={RESEARCH_STAGES[stageIndex]}>
        {/* Five stages, so the wait has a length rather than just a spinner. */}
        <ul className={styles.progress} aria-hidden="true">
          {RESEARCH_STAGES.map((stage, index) => (
            <li
              key={stage}
              className={styles.progressStep}
              data-passed={index <= stageIndex}
            />
          ))}
        </ul>
      </NowStage>,
    );
  }

  const content = chapter.content;
  const anchors = chapter.brief?.anchors ?? [];
  if (!content) {
    return shell(
      <NowStage headline="This chapter went missing.">
        <div className={styles.actions}>
          <button type="button" onClick={() => void refresh()}>
            Reload
          </button>
        </div>
      </NowStage>,
    );
  }

  if (chapter.status === "proposed") {
    /*
     * The proposal, dealt out rather than laid down all at once.
     *
     * The order is the point. What Chapter already knew about this person
     * comes first and alone, because that recognition is the only thing on
     * the screen they could not have got from any other app. The stretch
     * follows it, then the writing, and the place itself lands last: by then
     * it reads as the answer to something rather than as a listing.
     */
    return shell(
      <NowStage headline={content.title}>
        <article className={styles.card} data-beats="true">
          {/* One. What it already knew. The orbs are its working shown: every
              one of them is a node out of this person's own world. */}
          <p className={styles.known}>
            <AnchoredCopy text={content.knownLine} anchors={anchors} />
          </p>

          {/* Two. The one thing here that isn't already true about them. */}
          <p className={styles.unknown}>{content.unknownLine}</p>

          {/* Three. The writing. */}
          <p className={styles.invitation}>
            <AnchoredCopy text={content.invitation} anchors={anchors} />
          </p>

          {/* Four. The find, on its own plate, because it is the object the
              research went and came back with. */}
          <div className={styles.venue}>
            <p className={styles.venueName}>{content.venueName}</p>
            <p className={styles.venueMeta}>
              {content.venueArea}
              {content.address ? ` · ${content.address}` : ""}
            </p>
            <p className={styles.venueMeta}>
              {content.bestTime}
              {content.priceNote ? ` · ${content.priceNote}` : ""}
            </p>
            <p className={styles.whyUncommon}>{content.whyUncommon}</p>
            <Sources links={chapter.evidence ?? []} />
          </div>

          {/* Five. The only question left, asked once the answer is worth
              something: a day, chosen now that there is a reason to.

              The slot around it is what stays put. Saying "not this one"
              swaps what is inside it, and a beat that remounted there would
              wait out the arrival delay of a chapter that arrived long ago. */}
          <div className={styles.acceptSlot}>
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
              <p className={styles.acceptLabel}>When are you going?</p>
              <DayRail
                day={dateDraft}
                label="When you’re going"
                span={14}
                onChange={setDateDraft}
              />
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
          </div>
        </article>
      </NowStage>,
    );
  }

  // Accepted: the plan, then the reflection loop once the day has passed.
  const dayArrived =
    Boolean(chapter.scheduledFor) && chapter.scheduledFor! <= today;

  return shell(
    <NowStage headline={dayArrived ? "How was it?" : content.title}>
      <article className={styles.card}>
        <div className={styles.venue}>
          <p className={styles.venueName}>{content.venueName}</p>
          <p className={styles.venueMeta}>
            {content.venueArea}
            {content.address ? ` · ${content.address}` : ""}
          </p>
          <p className={styles.venueMeta}>
            {chapter.scheduledFor
              ? `${formatDay(chapter.scheduledFor, today)} · ${content.bestTime}`
              : content.bestTime}
          </p>
        </div>

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
                // Held so the world growing is something a person watches
                // happen, rather than something the next offer paints over.
                setReflectionDraft("");
                setJustLived(true);
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
          <p className={styles.waitCopy}>
            When the day passes, Chapter will ask how it went, and that story
            joins your world.
          </p>
        )}
        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </article>
    </NowStage>,
  );
}

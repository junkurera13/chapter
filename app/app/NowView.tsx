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
  cancelNowSchedule,
  declineNowChapter,
  loadNow,
  markNowChapterLived,
  nextSaturdayIso,
  NowRequestError,
  saveHomeCity,
  scheduleNowChapter,
  searchPlaceSuggestions,
  type PlaceSuggestion,
  startNowChapter,
  type NowState,
} from "../../lib/nowClient";
import {
  type NowAnchor,
  NOW_DEFAULT_REACH,
  NOW_LEAD_DAYS,
  NOW_REACH,
  NOW_REACHES,
  NOW_TIME_WINDOW_HOURS,
  NOW_TIME_WINDOWS,
  type NowReach,
  type NowTimeWindow,
} from "../../lib/nowChapterSchema";
import {
  daysBetween,
  describeWait,
  describeWindows,
  formatDay,
  formatWeekday,
  isoDay,
  sortWindows,
  upcomingDays,
  writingDayPhrase,
  writingStartsOn,
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

/** How far ahead the rail runs before it has to stretch for a chosen day. */
const RAIL_DAYS = 21;

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
 * The whole of the ask, in two questions with one answer each: which day, and
 * which parts of it. Everything else Chapter works out — the day it starts
 * writing is arithmetic, so the form states it rather than asking.
 *
 * A rail of real days rather than a date field. Picking a Saturday three weeks
 * out should feel like pointing at it on a calendar, and a day you can see the
 * weekday of is a day you can tell the truth about being free on.
 */
function ScheduleForm({
  busy,
  notice,
  day,
  windows,
  reach,
  onChangeDay,
  onToggleWindow,
  onChangeReach,
  onSubmit,
}: {
  busy: boolean;
  notice: string;
  day: string;
  windows: readonly NowTimeWindow[];
  reach: NowReach;
  onChangeDay: (day: string) => void;
  onChangeReach: (reach: NowReach) => void;
  /**
   * A toggle rather than a new list: two taps inside one frame would both be
   * answering the same stale set, and the second would undo the first.
   */
  onToggleWindow: (window: NowTimeWindow) => void;
  onSubmit: () => void;
}) {
  const today = useMemo(() => isoDay(), []);
  const railRef = useRef<HTMLDivElement>(null);

  // The rail normally runs three weeks out, and stretches only as far as it
  // must to keep a day that was already chosen inside it.
  const days = useMemo(() => {
    const reach = day ? daysBetween(today, day) + 3 : 0;
    return upcomingDays(Math.max(RAIL_DAYS, reach), today);
  }, [day, today]);

  // A day chosen weeks ago opens under the thumb rather than off the edge.
  // Deferred a frame because the form mounts before the dialog around it is
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

  const ready = Boolean(day) && windows.length > 0;
  const lead = !day
    ? `Pick a day. Chapter works back ${NOW_LEAD_DAYS} days from it.`
    : daysBetween(today, writingStartsOn(day)) <= 0
      ? "That’s inside three days, so Chapter starts writing the moment you set it."
      : `Chapter starts writing ${writingDayPhrase(day, today)}.`;

  return (
    <form
      className={styles.scheduleForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !busy) onSubmit();
      }}
    >
      <div
        className={styles.dayRail}
        ref={railRef}
        role="radiogroup"
        aria-label="Which day"
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
            onClick={() => onChangeDay(entry.iso)}
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

      <p className={styles.scheduleLabel}>
        {day ? `Free on ${formatWeekday(day)}` : "When you’re free"}
      </p>

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

      <p className={styles.scheduleLead} aria-live="polite">
        {lead}
      </p>
      <button type="submit" disabled={busy || !ready}>
        {day ? `Set ${formatDay(day, today)}` : "Set the day"}
      </button>
      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </form>
  );
}

/**
 * The form in a modal. Controlled rather than imperative: Escape closes a
 * <dialog> without telling React, so the close event is wired back to the
 * state that opened it and the two cannot end up disagreeing.
 */
function ScheduleDialog({
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
 * What the corner card says is coming. Exactly one of these is true at a time,
 * because Chapter runs one chapter at a time.
 */
type NowStanding =
  | { kind: "open" }
  | { kind: "scheduled"; day: string; windows: readonly NowTimeWindow[] }
  | { kind: "writing" }
  | { kind: "ready"; title: string }
  | { kind: "accepted"; title: string; day?: string };

function StandingBody({
  orb,
  primary,
  secondary,
  tag,
}: {
  orb: string;
  primary: string;
  secondary?: string;
  tag?: string;
}) {
  return (
    <>
      <span
        className={styles.standingOrb}
        style={{ background: orb }}
        aria-hidden="true"
      />
      <span className={styles.standingText}>
        <span className={styles.standingTitle}>{primary}</span>
        {secondary ? (
          <span className={styles.standingNote}>{secondary}</span>
        ) : null}
      </span>
      {tag ? <span className={styles.standingTag}>{tag}</span> : null}
    </>
  );
}

/**
 * The single row under "Coming up", saying the truest thing there is to say.
 *
 * Only a day that has been set aside is a button: it is the one state that is
 * still the card's to change. Once Chapter is writing, the screen behind the
 * card owns what happens next.
 */
function StandingRow({
  standing,
  onSchedule,
}: {
  standing: NowStanding;
  onSchedule: () => void;
}) {
  if (standing.kind === "open") {
    return (
      <button
        type="button"
        className={styles.standingInvite}
        onClick={onSchedule}
      >
        <span className={styles.standingInviteMark} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M12 5v14M5 12h14"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Set a day you’re free
      </button>
    );
  }

  if (standing.kind === "scheduled") {
    const windows = describeWindows(standing.windows);
    return (
      <>
        <button
          type="button"
          className={styles.standing}
          data-editable="true"
          onClick={onSchedule}
          aria-label={`${formatDay(standing.day)}, ${windows}. Change the day.`}
        >
          <StandingBody
            orb={WINDOW_ORB[standing.windows[0] ?? "evening"]}
            primary={formatDay(standing.day)}
            secondary={windows}
          />
        </button>
        <p className={styles.standingWait}>{describeWait(standing.day)}</p>
      </>
    );
  }

  if (standing.kind === "writing") {
    return (
      <p className={styles.standing} data-busy="true">
        <StandingBody
          orb={categoryOrbGradient("experience")}
          primary="Chapter is writing it"
          secondary="A few minutes of deep research"
        />
      </p>
    );
  }

  if (standing.kind === "ready") {
    return (
      <p className={styles.standing}>
        <StandingBody
          orb={categoryOrbGradient("experience")}
          primary={standing.title}
          secondary="Waiting on your yes"
        />
      </p>
    );
  }

  return (
    <p className={styles.standing}>
      <StandingBody
        orb={categoryOrbGradient("activity")}
        primary={standing.title}
        tag={standing.day ? formatDay(standing.day) : "No date yet"}
      />
    </p>
  );
}

/**
 * Where Now is looking, and what is already coming.
 *
 * Built from the same plate as Together's people card — soft grey, an orb and
 * a title across the top, one rule under it and no lines between the rows —
 * so the standing card in the corner is the same object in both tabs.
 *
 * The place is the card's title rather than a row in it: it is the one thing
 * that is always true of this card, and everything below it is a consequence
 * of being there.
 */
function HomeCityCard({
  homeCity,
  standing,
  notice,
  onChange,
  onSchedule,
}: {
  homeCity: string;
  standing: NowStanding;
  notice: string;
  /** Resolves true once the new place is saved, which closes the dialog. */
  onChange: (homeCity: string) => Promise<boolean>;
  /** Opens the day form. Only offered while a day is still the card's to set. */
  onSchedule: () => void;
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
      <aside className={styles.homeCard} aria-label="Where Now is looking">
        <p className={styles.homeCardHeader}>
          <span
            className={styles.homeCardOrb}
            style={{ background: categoryOrbGradient("place") }}
            aria-hidden="true"
          />
          <span className={styles.homeCardName} title={homeCity}>
            {near}
          </span>
          <button
            type="button"
            className={styles.homeCardAction}
            onClick={openDialog}
            aria-label={`Now is looking in ${homeCity}. Change it.`}
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
        </p>

        {/*
          What is already on its way. A card that only ever says where you are
          is a label; this is the half that makes it worth looking at.
        */}
        <p className={styles.homeCardLabel}>Coming up</p>
        <StandingRow standing={standing} onSchedule={onSchedule} />
      </aside>

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
  const [scheduling, setScheduling] = useState(false);
  const [dayDraft, setDayDraft] = useState("");
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
   * Opens the day form on whatever is already set aside, so changing your mind
   * about Saturday evening starts from Saturday evening rather than from
   * nothing.
   */
  const openSchedule = useCallback(() => {
    const scheduled = chapter?.status === "scheduled" ? chapter : null;
    setNotice("");
    setDayDraft(scheduled?.scheduledFor ?? "");
    setWindowDraft(scheduled?.timeWindows ?? []);
    // How far someone will go is a standing habit rather than a fact about one
    // Saturday, so it carries over from the last chapter instead of resetting.
    setReachDraft(scheduled?.reach ?? chapter?.reach ?? NOW_DEFAULT_REACH);
    setScheduling(true);
  }, [chapter]);

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

  /*
   * What the card says is coming. A chapter that has been said yes to, or a
   * day that has been set aside, stops being the screen's business and becomes
   * the card's; anything still asking a question stays on the screen, which is
   * already the place where questions get answered.
   */
  const standing: NowStanding =
    chapter?.status === "scheduled" && chapter.scheduledFor
      ? {
          kind: "scheduled",
          day: chapter.scheduledFor,
          windows: chapter.timeWindows ?? [],
        }
      : chapter?.status === "researching"
        ? { kind: "writing" }
        : chapter?.status === "proposed" && chapter.content
          ? { kind: "ready", title: chapter.content.title }
          : chapter?.status === "accepted" && chapter.content
            ? {
                kind: "accepted",
                title: chapter.content.title,
                day: chapter.scheduledFor,
              }
            : { kind: "open" };

  // Every screen past the ask carries the corner card, whatever it's showing.
  const withHomeCard = (screen: ReactNode) => (
    <>
      <HomeCityCard
        homeCity={now.homeCity}
        standing={standing}
        notice={notice}
        onChange={changeHomeCity}
        onSchedule={openSchedule}
      />
      <ScheduleDialog open={scheduling} onClose={() => setScheduling(false)}>
        <h2>When are you free?</h2>
        <p className={styles.homeDialogNow}>
          Chapter goes looking {NOW_LEAD_DAYS} days before the day itself.
        </p>
        <ScheduleForm
          busy={busy}
          notice={notice}
          day={dayDraft}
          windows={windowDraft}
          reach={reachDraft}
          onChangeDay={setDayDraft}
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
              await scheduleNowChapter(dayDraft, windowDraft, reachDraft);
              setScheduling(false);
            }, "Chapter couldn’t hold that day.")
          }
        />
        <button
          type="button"
          className={styles.homeDialogClose}
          onClick={() => setScheduling(false)}
        >
          {standing.kind === "scheduled" ? "Keep it as it is" : "Not yet"}
        </button>
      </ScheduleDialog>
      {screen}
    </>
  );

  if (!chapter || ["declined", "lived", "failed"].includes(chapter.status)) {
    return withHomeCard(
      <section className={styles.stateScreen}>
        <h1>Tell Chapter when you’re free.</h1>
        <p className={styles.stateCopy}>
          {chapter?.status === "declined"
            ? "Understood. Chapter will take a different angle on the next one."
            : chapter?.status === "lived"
              ? "That one’s part of your world now. Ready when you are."
              : chapter?.status === "failed"
                ? "The last search came home empty-handed. Rare, but it happens."
                : `Pick a day and the parts of it you have. ${NOW_LEAD_DAYS} days before, Chapter reads your world and goes looking for one real, uncommon experience in ${now.homeCity} — something that grew out of your memories, with one step into the unknown.`}
        </p>
        <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={openSchedule}>
            Choose a day
          </button>
          <button
            type="button"
            className={styles.quiet}
            disabled={busy}
            onClick={() =>
              void runAction(
                () => startNowChapter(),
                "Chapter couldn’t start writing.",
              )
            }
          >
            Or write one now
          </button>
        </div>
        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </section>,
    );
  }

  /*
   * A day set aside, still ahead of its lead time. There is nothing to do and
   * nothing to wait at: the screen says so, and says when that changes.
   */
  if (chapter.status === "scheduled" && chapter.scheduledFor) {
    const day = chapter.scheduledFor;
    const soon = daysBetween(isoDay(), writingStartsOn(day)) <= 0;
    return withHomeCard(
      <section className={styles.stateScreen}>
        <h1>{formatWeekday(day)} is yours.</h1>
        <p className={styles.stateCopy}>
          {describeWindows(chapter.timeWindows ?? [])} on {formatDay(day)}.{" "}
          {soon
            ? "Chapter is starting on it now — check back in a few minutes."
            : `It starts reading your world ${writingDayPhrase(day)} and goes looking from there. Nothing to do until then.`}
        </p>
        <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={openSchedule}>
            Change the day
          </button>
          <button
            type="button"
            className={styles.quiet}
            disabled={busy}
            onClick={() =>
              void runAction(
                () => startNowChapter(),
                "Chapter couldn’t start writing.",
              )
            }
          >
            Write it now
          </button>
          <button
            type="button"
            className={styles.quiet}
            disabled={busy}
            onClick={() =>
              void runAction(
                () => cancelNowSchedule(chapter.id),
                "Chapter couldn’t call that off.",
              )
            }
          >
            Call it off
          </button>
        </div>
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
                  min={isoDay()}
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
    Boolean(chapter.scheduledFor) && chapter.scheduledFor! <= isoDay();

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

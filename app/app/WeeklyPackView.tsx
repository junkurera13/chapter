"use client";

import Image from "next/image";
import type { StaticImageData } from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import ceramicImage from "@/app/assets/ceramics-class.jpg";
import stationImage from "@/app/assets/mojiko-memory/station.webp";
import coastalRideImage from "@/app/assets/coastal-ride-solo.jpg";
import ChapterLoadingMark from "@/components/chapter-loading-mark";
import AgentOrbVideo from "@/components/landing/agent-orb-video";
import EmbossedCardBack from "@/components/weekly-pack/EmbossedCardBack";
import type { NowChapterRecord } from "@/lib/nowChapterSchema";
import { loadNow } from "@/lib/nowClient";
import type { BubblegumTone } from "@/components/weekly-pack/emboss-engine";
import type { WorldNodeCategory } from "@/app/app/graphData";
import type { WeeklyPackScale } from "@/lib/weeklyPackDesign";
import {
  type WeeklyExperienceCard,
  type WeeklyExperiencePack,
} from "@/lib/weeklyPackSchema";
import {
  chooseWeeklyCard,
  dismissWeeklyPack,
  loadWeeklyPack,
  markWeeklyCardLived,
  revealWeeklyCard,
  scheduleWeeklyCard,
} from "@/lib/weeklyPackClient";
import {
  weeklyPackReviewFixture,
  type WeeklyPackReviewState,
} from "@/lib/weeklyPackPreview";
import { weeklyPackPhase } from "@/lib/weeklyPackPhase";
import { weeklyPackWindow } from "@/lib/weeklyPackSchedule";

import { categoryOrbGradient } from "./categoryAppearance";
import FirstExperienceView from "./FirstExperienceView";
import styles from "./WeeklyPackView.module.css";

type PackState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; pack: WeeklyExperiencePack | null };

const BUBBLEGUM_TONES: BubblegumTone[] = ["blue", "pink", "green"];
const REVIEW_CARD_IMAGES: Record<WeeklyPackScale, StaticImageData> = {
  small: stationImage,
  mini: ceramicImage,
  proper: coastalRideImage,
};
const WORLD_CATEGORIES: readonly WorldNodeCategory[] = [
  "experience",
  "people",
  "place",
  "activity",
  "interest",
  "feeling",
  "condition",
  "pattern",
];
const LOWERCASE_ANCHOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "is",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "via",
  "with",
]);

function orbCategory(category: string): WorldNodeCategory {
  return WORLD_CATEGORIES.includes(category as WorldNodeCategory)
    ? (category as WorldNodeCategory)
    : "pattern";
}

function weeklyCardLineParts(card: WeeklyExperienceCard) {
  type CardLineMarker = {
    label: string;
    category: string;
    preserveCase?: boolean;
  };
  let parts: Array<{
    text: string;
    marker?: CardLineMarker;
  }> = [{ text: card.line ?? card.promise }];

  const markers: CardLineMarker[] = [
    ...(card.anchors ?? []).map((anchor) => ({
      label: anchor.label,
      category: anchor.category,
    })),
    ...(card.companion
      ? [
          {
            label: card.companion.name,
            category: "people",
            preserveCase: true,
          },
        ]
      : []),
  ].sort((first, second) => second.label.length - first.label.length);

  for (const marker of markers) {
    parts = parts.flatMap((part) => {
      if (part.marker) return [part];
      const pieces = part.text.split(marker.label);
      if (pieces.length === 1) return [part];
      const marked: typeof parts = [];
      pieces.forEach((piece, index) => {
        if (index > 0) marked.push({ text: marker.label, marker });
        if (piece) marked.push({ text: piece });
      });
      return marked;
    });
  }

  return parts;
}

function titleCaseAnchorLabel(label: string) {
  return label
    .split(/(\s+)/)
    .map((word) => {
      if (!word.trim()) return word;
      if (LOWERCASE_ANCHOR_WORDS.has(word.toLocaleLowerCase())) {
        return word.toLocaleLowerCase();
      }
      return word.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase());
    })
    .join("");
}

function WeeklyCardLine({ card }: { card: WeeklyExperienceCard }) {
  return (
    <p className={styles.cardLine}>
      {weeklyCardLineParts(card).map((part, index) => {
        if (!part.marker) {
          return <span key={`${part.text}-${index}`}>{part.text}</span>;
        }

        const label = part.marker.preserveCase
          ? part.text
          : titleCaseAnchorLabel(part.text);
        const firstSpace = label.indexOf(" ");

        return (
          <span
            className={styles.cardAnchor}
            data-weekly-person={
              part.marker.category === "people" ? "true" : undefined
            }
            key={`${part.text}-${index}`}
          >
            <span className={styles.cardAnchorLead}>
              <span
                className={styles.cardAnchorOrb}
                style={{
                  background: categoryOrbGradient(
                    orbCategory(part.marker.category),
                  ),
                }}
                aria-hidden="true"
              />
              {firstSpace === -1 ? label : label.slice(0, firstSpace)}
            </span>
            {firstSpace === -1 ? "" : label.slice(firstSpace)}
          </span>
        );
      })}
    </p>
  );
}

function WeeklyCardLocation({ card }: { card: WeeklyExperienceCard }) {
  return (
    <div
      className={styles.cardLocation}
      aria-label={`Location: ${card.place.name}`}
    >
      <svg
        className={styles.cardLocationIcon}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 2.75a7.25 7.25 0 0 0-7.25 7.25c0 5.15 6.18 10.46 6.44 10.68a1.25 1.25 0 0 0 1.62 0c.26-.22 6.44-5.53 6.44-10.68A7.25 7.25 0 0 0 12 2.75Z" />
        <circle cx="12" cy="10" r="2.35" />
      </svg>
      <span title={card.place.name}>{card.place.name}</span>
    </div>
  );
}

function WeeklyCardPhoto({
  card,
  preview,
}: {
  card: WeeklyExperienceCard;
  preview: boolean;
}) {
  const previewImage = preview ? REVIEW_CARD_IMAGES[card.scale] : undefined;

  return (
    <div className={styles.cardShot} data-empty={!card.image && !previewImage}>
      {card.image ? (
        // The photograph comes from one of the pages already accepted as
        // evidence. It may be hosted anywhere that research can cite.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.image.url}
          alt={card.image.alt}
          loading="lazy"
          draggable={false}
          referrerPolicy="no-referrer"
        />
      ) : previewImage ? (
        <Image
          src={previewImage}
          alt=""
          fill
          sizes="(max-width: 760px) 78vw, 360px"
          placeholder="blur"
        />
      ) : null}
    </div>
  );
}

function localIsoDay(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayLabel(epoch: number, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...options,
  }).format(new Date(epoch));
}

function scheduledDayLabel(day: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00`));
}

function stableCardOrder(cards: WeeklyExperienceCard[], weekKey: string) {
  const seed = [...weekKey].reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );
  return [...cards].sort((first, second) => {
    const firstWeight =
      seed +
      [...first.id].reduce(
        (sum, character) => sum + character.charCodeAt(0),
        0,
      );
    const secondWeight =
      seed +
      [...second.id].reduce(
        (sum, character) => sum + character.charCodeAt(0),
        0,
      );
    return ((firstWeight * 31) % 17) - ((secondWeight * 31) % 17);
  });
}

function chosenCard(pack: WeeklyExperiencePack) {
  return pack.cards?.find((card) => card.id === pack.chosenCardId);
}

function LockedPackState({
  releaseAt,
  reduceMotion,
  needsLocation = false,
}: {
  releaseAt: number;
  reduceMotion: boolean;
  /**
   * Nothing can be researched without somewhere to research, so promising a
   * Saturday that cannot arrive is worse than asking for the missing piece.
   */
  needsLocation?: boolean;
}) {
  return (
    <section className={styles.statePage}>
      <motion.div
        className={styles.lockedLoader}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.975 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.55 }}
        aria-hidden="true"
      >
        <Image
          className={styles.lockedLoaderMark}
          src="/chapter-mark.svg"
          alt=""
          width={112}
          height={112}
        />
      </motion.div>
      <motion.div
        className={styles.stateCopy}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.14 }}
      >
        {needsLocation ? (
          <>
            <h1>Chapter needs to know where you are.</h1>
            <p>
              Set your location and your first experience starts straight away.
            </p>
          </>
        ) : (
          <>
            <h1>Your experiences are taking shape.</h1>
            <p>
              Ready{" "}
              <span className={styles.dateUnderline}>
                Saturday, {dayLabel(releaseAt, { weekday: undefined })}
              </span>
            </p>
          </>
        )}
      </motion.div>
    </section>
  );
}

export default function WeeklyPackView({
  reviewState,
  onReviewStateChange,
  reviewPack,
  watchFirstExperience = 0,
}: {
  reviewState?: WeeklyPackReviewState;
  onReviewStateChange?: (state: WeeklyPackReviewState) => void;
  reviewPack?: WeeklyExperiencePack;
  /**
   * Counts the times a first experience has been asked for. Non-zero means one
   * is being written even though no chapter exists to read yet, and a fresh
   * number restarts the wait after an earlier one gave up.
   */
  watchFirstExperience?: number;
}) {
  const reduceMotion = useReducedMotion();
  const initialReview = reviewPack
    ? { state: { status: "ready" as const, pack: reviewPack } }
    : reviewState
      ? weeklyPackReviewFixture(reviewState)
      : undefined;
  const initialReviewPack =
    initialReview?.state.status === "ready" ? initialReview.state.pack : null;
  const [state, setState] = useState<PackState>(
    () => initialReview?.state ?? { status: "loading" },
  );
  const [firstExperience, setFirstExperience] =
    useState<NowChapterRecord | null>(null);
  /** null until Now has been read once, so nothing is claimed before then. */
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<WeeklyPackScale | null>(
    initialReview?.pendingChoice ?? null,
  );
  const [committingChoice, setCommittingChoice] =
    useState<WeeklyPackScale | null>(null);
  const [busy, setBusy] = useState(false);
  const [openedPackId, setOpenedPackId] = useState<string | null>(() =>
    reviewState === "sealed" ? (initialReviewPack?.id ?? null) : null,
  );
  const [actionError, setActionError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(
    initialReview?.showDatePicker ?? false,
  );
  const [scheduledFor, setScheduledFor] = useState(
    initialReview?.scheduledFor ?? "",
  );
  const hydratedPackId = useRef(initialReviewPack?.id);
  const [settledCardIds, setSettledCardIds] = useState<Set<WeeklyPackScale>>(
    () => new Set(initialReviewPack?.revealedCardIds ?? []),
  );

  useEffect(() => {
    if (reviewState) return;

    let active = true;
    void Promise.all([
      loadWeeklyPack(),
      loadNow().catch(() => null),
    ])
      .then(([{ pack }, now]) => {
        if (!active) return;
        setState({ status: "ready", pack });
        const chapter = now?.chapter;
        setFirstExperience(
          chapter?.brief?.basis === "world" ? chapter : null,
        );
        if (now) setHomeCity(now.homeCity || "");
      })
      .catch((error) => {
        if (active) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Chapter couldn’t open this week’s pack.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [reviewState]);

  const firstExperienceStatus = firstExperience?.status;
  const hasFirstExperience = Boolean(firstExperience);

  useEffect(() => {
    if (reviewState) return;
    // Either an experience is being researched, or one is on its way and has
    // not been written down yet. Both are worth waiting on.
    const awaitingArrival = watchFirstExperience > 0 && !hasFirstExperience;
    if (firstExperienceStatus !== "researching" && !awaitingArrival) return;

    let active = true;
    let timer: number | undefined;
    // A first experience that never appears must not leave the tab polling for
    // the rest of the session.
    const giveUpAt = Date.now() + 4 * 60 * 1000;
    const poll = async () => {
      try {
        const now = await loadNow();
        if (!active) return;
        const chapter = now.chapter;
        const found = chapter?.brief?.basis === "world" ? chapter : null;
        setFirstExperience(found);
        setHomeCity(now.homeCity || "");
        const stillComing =
          chapter?.status === "researching" || (!found && watchFirstExperience > 0);
        if (stillComing && Date.now() < giveUpAt) {
          timer = window.setTimeout(() => void poll(), 5000);
        }
      } catch {
        if (active && Date.now() < giveUpAt) {
          timer = window.setTimeout(() => void poll(), 8000);
        }
      }
    };

    timer = window.setTimeout(() => void poll(), 5000);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // Deliberately keyed on primitives: depending on the chapter object would
    // restart this loop, and its give-up deadline, on every poll.
  }, [
    firstExperienceStatus,
    hasFirstExperience,
    watchFirstExperience,
    reviewState,
  ]);

  const pack = state.status === "ready" ? state.pack : null;

  useEffect(() => {
    if (!pack) return;

    setSettledCardIds((current) => {
      if (hydratedPackId.current !== pack.id) {
        hydratedPackId.current = pack.id;
        return new Set(pack.revealedCardIds);
      }

      const stillRevealed = new Set(
        [...current].filter((cardId) => pack.revealedCardIds.includes(cardId)),
      );
      return stillRevealed.size === current.size ? current : stillRevealed;
    });
  }, [pack]);

  const orderedCards = useMemo(
    () => stableCardOrder(pack?.cards ?? [], pack?.weekKey ?? ""),
    [pack?.cards, pack?.weekKey],
  );
  const pendingCard = orderedCards.find((card) => card.id === pendingChoice);

  async function reveal(cardId: WeeklyPackScale) {
    if (!pack || busy || pack.revealedCardIds.includes(cardId)) return;
    const before = pack;
    const optimistic = {
      ...pack,
      revealedCardIds: [...pack.revealedCardIds, cardId],
    };
    setState({ status: "ready", pack: optimistic });
    setActionError("");
    if (reviewState) return;

    try {
      const result = await revealWeeklyCard(pack.id, cardId);
      setState({ status: "ready", pack: result.pack });
    } catch (error) {
      setState({ status: "ready", pack: before });
      setActionError(
        error instanceof Error ? error.message : "That card stayed sealed.",
      );
    }
  }

  async function choose(cardId: WeeklyPackScale) {
    if (!pack || busy) return;
    setBusy(true);
    setActionError("");
    setCommittingChoice(cardId);
    try {
      if (reviewState) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, reduceMotion ? 0 : 620),
        );
        setState({
          status: "ready",
          pack: {
            ...pack,
            status: "chosen",
            chosenCardId: cardId,
            revealedCardIds: Array.from(
              new Set([...pack.revealedCardIds, cardId]),
            ),
          },
        });
      } else {
        const result = await chooseWeeklyCard(pack.id, cardId);
        setState({ status: "ready", pack: result.pack });
      }
      setPendingChoice(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Chapter couldn’t keep that card.",
      );
    } finally {
      setCommittingChoice(null);
      setBusy(false);
    }
  }

  async function schedule(nextScheduledFor: string) {
    if (!pack || !nextScheduledFor || busy) return;
    setBusy(true);
    setActionError("");
    try {
      if (reviewState) {
        setState({
          status: "ready",
          pack: { ...pack, scheduledFor: nextScheduledFor },
        });
      } else {
        const result = await scheduleWeeklyCard(pack.id, nextScheduledFor);
        setState({ status: "ready", pack: result.pack });
      }
      setShowDatePicker(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "That day didn’t save.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (!pack || busy) return;
    setBusy(true);
    setActionError("");
    try {
      if (reviewState) {
        setState({
          status: "ready",
          pack: { ...pack, status: "dismissed" },
        });
      } else {
        const result = await dismissWeeklyPack(pack.id);
        setState({ status: "ready", pack: result.pack });
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "That didn’t save.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function markLived() {
    if (!pack || busy) return;
    setBusy(true);
    setActionError("");
    try {
      if (reviewState) {
        setState({
          status: "ready",
          pack: { ...pack, status: "lived", livedAt: Date.now() },
        });
      } else {
        const result = await markWeeklyCardLived(pack.id);
        setState({ status: "ready", pack: result.pack });
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "That didn’t save.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openPack() {
    if (!pack || orderedCards.length === 0 || busy) return;

    if (reviewState && onReviewStateChange) {
      onReviewStateChange("sealed");
      return;
    }

    setOpenedPackId(pack.id);
  }

  function replayPreview() {
    if (onReviewStateChange) {
      onReviewStateChange("sealed");
      return;
    }
    if (reviewPack) {
      setState({
        status: "ready",
        pack: {
          ...reviewPack,
          status: "available",
          revealedCardIds: [],
          chosenCardId: undefined,
          scheduledFor: undefined,
          livedAt: undefined,
        },
      });
      setPendingChoice(null);
      setShowDatePicker(false);
      setScheduledFor("");
      setOpenedPackId(reviewPack.id);
      return;
    }
    const fixture = weeklyPackReviewFixture("sealed");
    const replayPack =
      fixture.state.status === "ready" ? fixture.state.pack : null;
    setState(fixture.state);
    setOpenedPackId(replayPack?.id ?? null);
  }

  const phase = weeklyPackPhase({
    state,
    openedPackId,
    pendingChoice,
    showDatePicker,
  });

  if (
    !reviewState &&
    firstExperience &&
    !["scheduled", "declined", "lived"].includes(firstExperience.status)
  ) {
    return (
      <FirstExperienceView
        chapter={firstExperience}
        onChapterChange={setFirstExperience}
      />
    );
  }

  if (phase === "loading") {
    return (
      <section className={styles.statePage} aria-busy="true">
        <ChapterLoadingMark label="Opening Saturday" />
      </section>
    );
  }

  if (phase === "error") {
    const message =
      state.status === "error"
        ? state.message
        : "Chapter couldn’t open this week’s pack.";
    return (
      <section className={styles.statePage} role="alert">
        <div className={styles.stateCopy}>
          <h1>The pack stayed closed.</h1>
          <p>{message}</p>
          <button
            type="button"
            className={styles.darkAction}
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!pack) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const { releaseAt } = weeklyPackWindow({ timezone });
    return (
      <LockedPackState
        releaseAt={releaseAt}
        reduceMotion={Boolean(reduceMotion)}
        // Only once Now has actually been read: an empty string means asked
        // and answered with nothing, null means not asked yet.
        needsLocation={homeCity === ""}
      />
    );
  }

  if (phase === "locked") {
    return (
      <LockedPackState
        releaseAt={pack.releaseAt}
        reduceMotion={Boolean(reduceMotion)}
      />
    );
  }

  if (phase === "dismissed" || phase === "expired" || phase === "failed") {
    const title =
      phase === "dismissed"
        ? "Not this week."
        : phase === "expired"
          ? "This pack has passed."
          : "This pack didn’t make it.";
    const body =
      phase === "dismissed"
        ? "Saturday will bring three new cards."
        : phase === "expired"
          ? "A new set arrives on Saturday."
          : "Chapter will try again before the next Saturday.";
    return (
      <section className={styles.statePage}>
        <div className={styles.closedMark} aria-hidden="true">
          <Image src="/chapter-mark.svg" alt="" width={56} height={56} />
        </div>
        <div className={styles.stateCopy}>
          <h1>{title}</h1>
          <p>{body}</p>
          {reviewState ? (
            <button
              type="button"
              className={styles.textAction}
              onClick={replayPreview}
            >
              Replay preview
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (
    phase === "chosen" ||
    phase === "date-picker" ||
    phase === "scheduled" ||
    phase === "lived"
  ) {
    const card = chosenCard(pack);
    if (!card) {
      return (
        <section className={styles.statePage}>
          <div className={styles.stateCopy}>
            <h1>Your card is safe.</h1>
            <p>Chapter couldn’t open its details just now.</p>
          </div>
        </section>
      );
    }
    return (
      <ChosenExperience
        card={card}
        pack={pack}
        busy={busy}
        actionError={actionError}
        showDatePicker={showDatePicker}
        scheduledFor={scheduledFor}
        reduceMotion={Boolean(reduceMotion)}
        preview={Boolean(reviewState)}
        onShowDatePicker={() => {
          setScheduledFor(pack.scheduledFor ?? localIsoDay());
          setShowDatePicker(true);
        }}
        onDateChange={setScheduledFor}
        onSchedule={(day) => void schedule(day)}
        onCancelDate={() => setShowDatePicker(false)}
        onDismiss={() => void dismiss()}
        onLived={() => void markLived()}
        onReplay={replayPreview}
      />
    );
  }

  if (phase === "opener") {
    return (
      <PackOpener
        busy={busy}
        reduceMotion={Boolean(reduceMotion)}
        onOpen={openPack}
      />
    );
  }

  return (
    <section className={styles.packPage}>
      <motion.header
        className={styles.packHeader}
        initial={
          reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(3px)" }
        }
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{
          duration: reduceMotion ? 0 : 0.55,
          delay: reduceMotion ? 0 : 0.08,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className={styles.packHeaderTitle}>
          <span className={styles.packHeaderOrb} aria-hidden="true">
            <AgentOrbVideo playWhileMounted preload="auto" />
          </span>
          <h1>Choose one</h1>
        </div>
      </motion.header>

      <ol className={styles.cardGrid} aria-label="This week’s three cards">
        {orderedCards.map((card, index) => {
          const revealed = pack.revealedCardIds.includes(card.id);
          const committing = Boolean(committingChoice);
          const isChosen = committingChoice === card.id;
          const selected = pendingChoice === card.id;
          const dimmed = Boolean(pendingChoice) && !selected;
          return (
            <motion.li
              key={card.id}
              className={styles.cardSlot}
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 28,
                      scale: 0.98,
                      filter: "blur(4px)",
                      rotate: index === 0 ? -1.4 : index === 2 ? 1.4 : 0,
                    }
              }
              animate={
                committing
                  ? isChosen
                    ? { opacity: 1, y: -8, scale: 1.025, filter: "none" }
                    : { opacity: 0, y: 22, scale: 0.94, filter: "blur(3px)" }
                  : selected
                    ? {
                        opacity: 1,
                        y: -5,
                        scale: 1,
                        filter: "none",
                      }
                    : dimmed
                      ? {
                          opacity: 0.38,
                          y: 3,
                          scale: 0.985,
                          filter: "saturate(0.55)",
                        }
                      : {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          filter: "none",
                        }
              }
              transition={{
                duration: committing ? 0.48 : pendingChoice ? 0.35 : 0.68,
                delay: committing || pendingChoice ? 0 : 0.18 + index * 0.09,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <motion.div
                className={styles.cardHover}
                whileHover={
                  reduceMotion || committing
                    ? undefined
                    : { y: -7, scale: 1.01 }
                }
                whileTap={
                  reduceMotion || committing
                    ? undefined
                    : { y: -4, scale: 1.004 }
                }
                transition={{
                  duration: 0.34,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className={styles.cardScene}>
                  <div
                    className={styles.cardInner}
                    data-revealed={revealed ? "true" : "false"}
                    data-settled={
                      revealed &&
                      (Boolean(reduceMotion) || settledCardIds.has(card.id))
                        ? "true"
                        : "false"
                    }
                    data-reduced-motion={reduceMotion ? "true" : "false"}
                    onTransitionEnd={(event) => {
                      if (
                        event.target !== event.currentTarget ||
                        event.propertyName !== "transform" ||
                        !revealed
                      ) {
                        return;
                      }
                      setSettledCardIds((current) => {
                        if (current.has(card.id)) return current;
                        const next = new Set(current);
                        next.add(card.id);
                        return next;
                      });
                    }}
                  >
                    <button
                      type="button"
                      className={`${styles.cardFace} ${styles.cardBack}`}
                      onClick={() => void reveal(card.id)}
                      disabled={busy || revealed}
                      aria-label={`Turn over card ${index + 1}`}
                      aria-hidden={revealed}
                      tabIndex={revealed ? -1 : 0}
                    >
                      <EmbossedCardBack
                        number={`${index + 1}`.padStart(2, "0")}
                        tone={BUBBLEGUM_TONES[index % BUBBLEGUM_TONES.length]}
                      />
                    </button>

                    <article
                      className={`${styles.cardFace} ${styles.cardFront}`}
                      data-selected={selected ? "true" : "false"}
                      aria-hidden={!revealed}
                      inert={!revealed}
                    >
                      <button
                        type="button"
                        className={styles.cardSelectHit}
                        aria-label={`Select ${card.title}`}
                        aria-pressed={selected}
                        onClick={(event) => {
                          if (event.detail > 0) event.currentTarget.blur();
                          setPendingChoice(card.id);
                        }}
                        disabled={busy || committing}
                      />

                      <div className={styles.cardSay}>
                        <WeeklyCardLine card={card} />
                        <WeeklyCardLocation card={card} />
                      </div>

                      <WeeklyCardPhoto
                        card={card}
                        preview={Boolean(reviewState)}
                      />
                    </article>
                  </div>
                </div>
              </motion.div>
            </motion.li>
          );
        })}
      </ol>

      <div className={styles.packContinueSlot}>
        <AnimatePresence initial={false}>
          {pendingCard && !committingChoice ? (
            <motion.button
              key="continue"
              type="button"
              className={styles.packContinue}
              aria-label={`Continue with ${pendingCard.title}`}
              onClick={() => void choose(pendingCard.id)}
              disabled={busy}
              initial={
                reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.9 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { y: 2, scale: 0.985 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 4, scale: 0.95 }
              }
              transition={{
                duration: reduceMotion ? 0.12 : 0.22,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      {actionError ? (
        <div className={styles.packFooter}>
          <p className={styles.actionError} role="alert">
            {actionError}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function PackOpener({
  busy,
  reduceMotion,
  onOpen,
}: {
  busy: boolean;
  reduceMotion: boolean;
  onOpen: () => void;
}) {
  const [opening, setOpening] = useState(false);

  function beginOpening() {
    if (busy || opening) return;
    setOpening(true);
  }

  return (
    <section className={styles.openerPage}>
      <motion.div
        className={styles.opener}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.975 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.55 }}
      >
        <motion.button
          type="button"
          className={styles.openerButton}
          data-opening={opening ? "true" : "false"}
          onClick={beginOpening}
          disabled={busy || opening}
          aria-label="See your experiences"
          animate={
            opening
              ? {
                  opacity: [1, 1, 0],
                  scale: [1, 1.08, 1.72],
                  filter: ["blur(0px)", "blur(0px)", "blur(12px)"],
                }
              : { opacity: 1, scale: 1, filter: "blur(0px)" }
          }
          whileHover={reduceMotion || opening ? undefined : { scale: 1.035 }}
          whileTap={reduceMotion || opening ? undefined : { scale: 0.985 }}
          transition={
            opening
              ? {
                  duration: reduceMotion ? 0 : 1.18,
                  delay: reduceMotion ? 0 : 0.08,
                  times: [0, 0.48, 1],
                  ease: "easeInOut",
                }
              : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
          }
          onAnimationComplete={() => {
            if (opening) onOpen();
          }}
        >
          <span className={styles.openerOrb} aria-hidden="true">
            <AgentOrbVideo playWhileMounted preload="auto" />
          </span>
        </motion.button>
        <motion.div
          className={styles.stateCopy}
          animate={
            opening
              ? { opacity: 0, y: -4, filter: "blur(2px)" }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.24,
            ease: "easeOut",
          }}
        >
          <h1>Your experiences are ready.</h1>
        </motion.div>
      </motion.div>
    </section>
  );
}

function ChosenExperience({
  card,
  pack,
  busy,
  actionError,
  showDatePicker,
  scheduledFor,
  reduceMotion,
  preview,
  onShowDatePicker,
  onDateChange,
  onSchedule,
  onCancelDate,
  onDismiss,
  onLived,
  onReplay,
}: {
  card: WeeklyExperienceCard;
  pack: WeeklyExperiencePack;
  busy: boolean;
  actionError: string;
  showDatePicker: boolean;
  scheduledFor: string;
  reduceMotion: boolean;
  preview: boolean;
  onShowDatePicker: () => void;
  onDateChange: (value: string) => void;
  onSchedule: (day: string) => void;
  onCancelDate: () => void;
  onDismiss: () => void;
  onLived: () => void;
  onReplay: () => void;
}) {
  const latestDay = localIsoDay(new Date(pack.expiresAt - 1));
  const showCalendar = showDatePicker || Boolean(pack.scheduledFor);
  const canMarkLived = Boolean(
    pack.scheduledFor && pack.scheduledFor <= localIsoDay(),
  );
  const mapQuery = `${card.place.name}, ${card.place.address}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const kakaoMapsUrl = `https://m.map.kakao.com/scheme/search?q=${encodeURIComponent(mapQuery)}`;
  return (
    <section className={styles.chosenPage}>
      <motion.div
        className={styles.chosenLayout}
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.article
          className={styles.chosenExperienceCard}
          initial={reduceMotion ? false : { rotate: -0.7 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className={styles.visuallyHidden}>{card.title}</h1>
          <div className={styles.chosenCardSay}>
            <WeeklyCardLine card={card} />
          </div>
          <WeeklyCardPhoto card={card} preview={preview} />
        </motion.article>

        <motion.aside
          className={styles.chosenDetails}
          initial={reduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.48,
            delay: reduceMotion ? 0 : 0.14,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className={styles.chosenLocation}>
            <svg
              className={`${styles.detailIcon} ${styles.locationIcon}`}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2.75a7.25 7.25 0 0 0-7.25 7.25c0 5.15 6.18 10.46 6.44 10.68a1.25 1.25 0 0 0 1.62 0c.26-.22 6.44-5.53 6.44-10.68A7.25 7.25 0 0 0 12 2.75Z" />
              <circle cx="12" cy="10" r="2.35" />
            </svg>
            <span className={styles.visuallyHidden}>Location</span>
            <div className={styles.chosenLocationCopy}>
              <h2>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${card.place.name} in Google Maps`}
                >
                  {card.place.name}
                </a>
              </h2>
              <p>{card.place.area}</p>
              <div className={styles.mapLinks}>
                <a href={googleMapsUrl} target="_blank" rel="noreferrer">
                  Google Maps
                </a>
                <a href={kakaoMapsUrl} target="_blank" rel="noreferrer">
                  Kakao Maps
                </a>
              </div>
            </div>
          </div>

          <div
            className={styles.chosenWhen}
            data-has-icon={showCalendar ? "true" : "false"}
          >
            {showCalendar ? (
              <>
                <svg
                  className={styles.detailIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M6.75 3.5v3M17.25 3.5v3M4 9h16M5.75 5h12.5A1.75 1.75 0 0 1 20 6.75v11.5A1.75 1.75 0 0 1 18.25 20H5.75A1.75 1.75 0 0 1 4 18.25V6.75A1.75 1.75 0 0 1 5.75 5Z" />
                </svg>
                <span className={styles.visuallyHidden}>When</span>
              </>
            ) : null}
            <div className={styles.chosenWhenContent}>
              {pack.status === "lived" ? (
                <div className={styles.livedState}>
                  <span className={styles.livedMark} aria-hidden="true">
                    <svg viewBox="0 0 20 20">
                      <path d="m4.5 10.3 3.3 3.3 7.7-8" />
                    </svg>
                  </span>
                  <p>You lived this one.</p>
                  {preview ? (
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={onReplay}
                    >
                      Replay preview
                    </button>
                  ) : null}
                </div>
              ) : showDatePicker ? (
                <form
                  className={styles.dateChoice}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input =
                      event.currentTarget.elements.namedItem("scheduledFor");
                    if (input instanceof HTMLInputElement) {
                      onSchedule(input.value);
                    }
                  }}
                >
                  <label>
                    <span className={styles.visuallyHidden}>Choose a day</span>
                    <input
                      type="date"
                      name="scheduledFor"
                      min={localIsoDay()}
                      max={latestDay}
                      value={scheduledFor}
                      onChange={(event) => onDateChange(event.target.value)}
                    />
                  </label>
                  <div>
                    <button
                      type="submit"
                      className={styles.darkAction}
                      disabled={busy || !scheduledFor}
                    >
                      Save the day
                    </button>
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={onCancelDate}
                      disabled={busy}
                    >
                      Not yet
                    </button>
                  </div>
                </form>
              ) : (
                <div className={styles.chosenActions}>
                  {pack.scheduledFor ? (
                    <p className={styles.scheduled}>
                      {scheduledDayLabel(pack.scheduledFor)}
                    </p>
                  ) : null}
                  <div className={styles.primaryActions}>
                    <button
                      type="button"
                      className={styles.darkAction}
                      onClick={onShowDatePicker}
                      disabled={busy}
                    >
                      {pack.scheduledFor ? "Change the day" : "Choose a day"}
                    </button>
                  </div>
                  <div className={styles.secondaryActions}>
                    {canMarkLived ? (
                      <button
                        type="button"
                        className={styles.textAction}
                        onClick={onLived}
                        disabled={busy}
                      >
                        I did this
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={onDismiss}
                      disabled={busy}
                    >
                      Not this time
                    </button>
                  </div>
                </div>
              )}
              {actionError ? (
                <p className={styles.actionError} role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
          </div>
        </motion.aside>
      </motion.div>
    </section>
  );
}

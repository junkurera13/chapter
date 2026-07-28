"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import ChapterLoadingMark from "@/components/chapter-loading-mark";
import AgentOrbVideo from "@/components/landing/agent-orb-video";
import type { WeeklyPackScale } from "@/lib/weeklyPackDesign";
import {
  WEEKLY_COMPANY_LABELS,
  WEEKLY_SCALE_LABELS,
  formatWeeklyDuration,
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

import styles from "./WeeklyPackView.module.css";

type PackState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; pack: WeeklyExperiencePack | null };

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
      seed + [...first.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const secondWeight =
      seed + [...second.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return (firstWeight * 31) % 17 - ((secondWeight * 31) % 17);
  });
}

function chosenCard(pack: WeeklyExperiencePack) {
  return pack.cards?.find((card) => card.id === pack.chosenCardId);
}

export default function WeeklyPackView({
  reviewState,
  onReviewStateChange,
}: {
  reviewState?: WeeklyPackReviewState;
  onReviewStateChange?: (state: WeeklyPackReviewState) => void;
}) {
  const reduceMotion = useReducedMotion();
  const initialReview = reviewState
    ? weeklyPackReviewFixture(reviewState)
    : undefined;
  const [state, setState] = useState<PackState>(
    () => initialReview?.state ?? { status: "loading" },
  );
  const [pendingChoice, setPendingChoice] =
    useState<WeeklyPackScale | null>(initialReview?.pendingChoice ?? null);
  const [committingChoice, setCommittingChoice] =
    useState<WeeklyPackScale | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(
    initialReview?.showDatePicker ?? false,
  );
  const [scheduledFor, setScheduledFor] = useState(
    initialReview?.scheduledFor ?? "",
  );

  useEffect(() => {
    if (reviewState) return;

    let active = true;
    void loadWeeklyPack()
      .then(({ pack }) => {
        if (active) setState({ status: "ready", pack });
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

  const pack = state.status === "ready" ? state.pack : null;
  const orderedCards = useMemo(
    () => stableCardOrder(pack?.cards ?? [], pack?.weekKey ?? ""),
    [pack?.cards, pack?.weekKey],
  );

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
        await new Promise((resolve) => window.setTimeout(resolve, reduceMotion ? 0 : 620));
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
    const firstCard = orderedCards[0];
    if (!firstCard || busy) return;

    if (reviewState && onReviewStateChange) {
      onReviewStateChange("one-revealed");
      return;
    }

    void reveal(firstCard.id);
  }

  if (state.status === "loading") {
    return (
      <section className={styles.statePage} aria-busy="true">
        <ChapterLoadingMark label="Opening Saturday" />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.statePage} role="alert">
        <div className={styles.stateCopy}>
          <h1>The pack stayed closed.</h1>
          <p>{state.message}</p>
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
    return (
      <section className={styles.statePage}>
        <SealedStack />
        <div className={styles.stateCopy}>
          <h1>Saturday</h1>
          <p>Your first pack is being made.</p>
        </div>
      </section>
    );
  }

  if (pack.status === "locked") {
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
          <h1>Your experiences are taking shape.</h1>
          <p>
            Ready{" "}
            <span className={styles.dateUnderline}>
              Saturday, {dayLabel(pack.releaseAt, { weekday: undefined })}
            </span>
          </p>
        </motion.div>
      </section>
    );
  }

  if (
    pack.status === "dismissed" ||
    pack.status === "expired" ||
    pack.status === "failed"
  ) {
    const title =
      pack.status === "dismissed"
        ? "Not this week."
        : pack.status === "expired"
          ? "This pack has passed."
          : "This pack didn’t make it.";
    const body =
      pack.status === "dismissed"
        ? "Saturday will bring three new cards."
        : pack.status === "expired"
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
              onClick={() =>
                setState(weeklyPackReviewFixture("sealed").state)
              }
            >
              Replay preview
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (pack.status === "chosen" || pack.status === "lived") {
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
        onReplay={() =>
          setState(weeklyPackReviewFixture("sealed").state)
        }
      />
    );
  }

  if (
    pack.status === "available" &&
    pack.revealedCardIds.length === 0 &&
    orderedCards.length > 0 &&
    reviewState !== "sealed"
  ) {
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
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42 }}
      >
        <h1>Choose one.</h1>
        <p>Turn them over. Keep one.</p>
      </motion.header>

      <ol className={styles.cardGrid} aria-label="This week’s three cards">
        {orderedCards.map((card, index) => {
          const revealed = pack.revealedCardIds.includes(card.id);
          const committing = Boolean(committingChoice);
          const isChosen = committingChoice === card.id;
          return (
            <motion.li
              key={card.id}
              className={styles.cardSlot}
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 24,
                      rotate: index === 0 ? -1.4 : index === 2 ? 1.4 : 0,
                    }
              }
              animate={
                committing
                  ? isChosen
                    ? { opacity: 1, y: -8, scale: 1.025, filter: "blur(0px)" }
                    : { opacity: 0, y: 22, scale: 0.94, filter: "blur(3px)" }
                  : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
              }
              transition={{
                duration: committing ? 0.48 : 0.55,
                delay: committing ? 0 : index * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className={styles.cardScene}>
                <div
                  className={styles.cardInner}
                  data-revealed={revealed ? "true" : "false"}
                  data-reduced-motion={reduceMotion ? "true" : "false"}
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
                    <span className={styles.cardNumber}>
                      {`${index + 1}`.padStart(2, "0")}
                    </span>
                    <span className={styles.backMark} aria-hidden="true">
                      <Image
                        src="/chapter-mark.svg"
                        alt=""
                        width={58}
                        height={58}
                      />
                    </span>
                    <span className={styles.turnHint}>Turn over</span>
                  </button>

                  <article
                    className={`${styles.cardFace} ${styles.cardFront}`}
                    data-scale={card.scale}
                    aria-hidden={!revealed}
                    inert={!revealed}
                  >
                    <div>
                      <p className={styles.formatLabel}>
                        {WEEKLY_SCALE_LABELS[card.scale]}
                      </p>
                      <h2>{card.title}</h2>
                      <p className={styles.cardPromise}>{card.promise}</p>
                    </div>

                    <div className={styles.cardFoot}>
                      <div className={styles.cardMeta}>
                        <span>{formatWeeklyDuration(card.durationMinutes)}</span>
                        <span>{WEEKLY_COMPANY_LABELS[card.company]}</span>
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        {pendingChoice === card.id ? (
                          <motion.div
                            key="confirm"
                            className={styles.confirmChoice}
                            initial={
                              reduceMotion ? false : { opacity: 0, y: 5 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                          >
                            <button
                              type="button"
                              className={styles.keepAction}
                              onClick={() => void choose(card.id)}
                              disabled={busy}
                            >
                              Keep it
                            </button>
                            <button
                              type="button"
                              className={styles.backAction}
                              onClick={() => setPendingChoice(null)}
                              disabled={busy}
                            >
                              Back
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            key="keep"
                            type="button"
                            className={styles.keepAction}
                            onClick={() => setPendingChoice(card.id)}
                            disabled={busy}
                            initial={
                              reduceMotion ? false : { opacity: 0, y: 5 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                          >
                            Keep this
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </article>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div className={styles.packFooter}>
        <p className={styles.expiry}>
          Keep one by {dayLabel(pack.expiresAt, { weekday: undefined })}.
        </p>
        {actionError ? (
          <p className={styles.actionError} role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
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
          onClick={onOpen}
          disabled={busy}
          aria-label="See your experiences"
          whileHover={reduceMotion ? undefined : { scale: 1.035 }}
          whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={styles.openerOrb} aria-hidden="true">
            <AgentOrbVideo playWhileMounted preload="auto" />
          </span>
        </motion.button>
        <div className={styles.stateCopy}>
          <h1>Your experiences are ready.</h1>
        </div>
      </motion.div>
    </section>
  );
}

function SealedStack() {
  return (
    <motion.div
      className={styles.sealedStack}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      <span />
      <span />
      <span>
        <Image
          src="/chapter-mark.svg"
          alt=""
          width={64}
          height={64}
          loading="eager"
        />
      </span>
    </motion.div>
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
  return (
    <section className={styles.chosenPage}>
      <motion.article
        className={styles.chosenCard}
        initial={
          reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className={styles.chosenHeader}>
          <p className={styles.formatLabel}>
            {WEEKLY_SCALE_LABELS[card.scale]}
          </p>
          <h1>{card.title}</h1>
          <p className={styles.chosenOpening}>{card.opening}</p>
          <div className={styles.chosenMeta}>
            <span>{formatWeeklyDuration(card.durationMinutes)}</span>
            <span>{WEEKLY_COMPANY_LABELS[card.company]}</span>
          </div>
        </header>

        <div className={styles.experienceBody}>
          <div className={styles.experienceSteps}>
            {card.steps.map((step, index) => (
              <div className={styles.step} key={step}>
                <span>{`${index + 1}`.padStart(2, "0")}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>

          <aside className={styles.practical}>
            {card.place ? (
              <div className={styles.practicalRow}>
                <span>Place</span>
                <p>
                  {card.place.name}
                  <small>{card.place.area}</small>
                </p>
              </div>
            ) : null}
            {card.practical.map((item) => (
              <div className={styles.practicalRow} key={item.label}>
                <span>{item.label}</span>
                <p>{item.value}</p>
              </div>
            ))}
          </aside>
        </div>

        <footer className={styles.chosenActions}>
          {pack.status === "lived" ? (
            <div className={styles.livedState}>
              <span className={styles.livedMark} aria-hidden="true">
                <svg viewBox="0 0 20 20">
                  <path d="m4.5 10.3 3.3 3.3 7.7-8" />
                </svg>
              </span>
              <p>You lived this one.</p>
              {preview ? (
                <button type="button" className={styles.textAction} onClick={onReplay}>
                  Replay preview
                </button>
              ) : null}
            </div>
          ) : showDatePicker ? (
            <form
              className={styles.dateChoice}
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem(
                  "scheduledFor",
                );
                if (input instanceof HTMLInputElement) {
                  onSchedule(input.value);
                }
              }}
            >
              <label>
                <span>Choose a day</span>
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
            <>
              {pack.scheduledFor ? (
                <p className={styles.scheduled}>
                  <span>Set for</span>
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
                <button
                  type="button"
                  className={styles.lightAction}
                  onClick={onLived}
                  disabled={busy}
                >
                  I did this
                </button>
              </div>
              <button
                type="button"
                className={styles.textAction}
                onClick={onDismiss}
                disabled={busy}
              >
                Not this time
              </button>
            </>
          )}
          {actionError ? (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          ) : null}
        </footer>
      </motion.article>
    </section>
  );
}

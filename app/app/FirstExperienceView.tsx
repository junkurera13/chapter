"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import AgentOrbVideo from "@/components/landing/agent-orb-video";
import {
  acceptNowChapter,
  declineNowChapter,
  markNowChapterLived,
  startFirstExperience,
} from "@/lib/nowClient";
import type { NowChapterRecord } from "@/lib/nowChapterSchema";

import styles from "./FirstExperienceView.module.css";

function localIsoDay(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function scheduledDayLabel(day: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00`));
}

export default function FirstExperienceView({
  chapter,
  onChapterChange,
}: {
  chapter: NowChapterRecord;
  onChapterChange: (chapter: NowChapterRecord) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(
    chapter.scheduledFor ?? localIsoDay(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function chooseDay() {
    if (!scheduledFor || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await acceptNowChapter(chapter.id, scheduledFor);
      onChapterChange(result.chapter);
      setShowDatePicker(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That day couldn’t be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await declineNowChapter(chapter.id, "");
      onChapterChange(result.chapter);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That choice couldn’t be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function markLived() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await markNowChapterLived(chapter.id);
      onChapterChange(result.chapter);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That couldn’t be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await startFirstExperience();
      onChapterChange(result.chapter);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Chapter couldn’t start another search.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (chapter.status === "researching") {
    return (
      <section className={styles.statusPage} aria-live="polite">
        <motion.div
          className={styles.statusOrb}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.975 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
          aria-hidden="true"
        >
          <AgentOrbVideo playWhileMounted preload="auto" />
        </motion.div>
        <motion.div
          className={styles.statusCopy}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.42,
            delay: reduceMotion ? 0 : 0.1,
          }}
        >
          <h1>Your first experience is taking shape.</h1>
          <p>Chapter is looking around your city now.</p>
        </motion.div>
      </section>
    );
  }

  if (chapter.status === "failed") {
    return (
      <section className={styles.statusPage} role="alert">
        <div className={styles.statusCopy}>
          <h1>That one didn’t come together.</h1>
          <p>Your memory is safe. Chapter can look again.</p>
          <button
            type="button"
            className={styles.primaryAction}
            disabled={busy}
            onClick={() => void retry()}
          >
            Try again
          </button>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </section>
    );
  }

  const content = chapter.content;
  if (!content) {
    return (
      <section className={styles.statusPage} role="alert">
        <div className={styles.statusCopy}>
          <h1>Your first experience stayed closed.</h1>
          <p>Chapter couldn’t open its details just now.</p>
        </div>
      </section>
    );
  }

  const mapQuery = `${content.venueName}, ${content.address ?? content.venueArea}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const kakaoMapsUrl = `https://m.map.kakao.com/scheme/search?q=${encodeURIComponent(mapQuery)}`;
  const canMarkLived = Boolean(
    chapter.scheduledFor && chapter.scheduledFor <= localIsoDay(),
  );

  return (
    <section className={styles.experiencePage}>
      <motion.div
        className={styles.layout}
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.988 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.58, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.heading}>
          <span className={styles.headingOrb} aria-hidden="true">
            <AgentOrbVideo playWhileMounted preload="auto" />
          </span>
          <h1>Your first experience</h1>
        </div>

        <article className={styles.card}>
          <p className={styles.line}>{content.line}</p>
          <div className={styles.photo} data-empty={!content.imageUrl}>
            {content.imageUrl ? (
              // The URL comes from the already accepted research evidence.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.imageUrl}
                alt={`A view of ${content.venueName}`}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>
        </article>

        <aside className={styles.details}>
          <div className={styles.location}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.75a7.25 7.25 0 0 0-7.25 7.25c0 5.15 6.18 10.46 6.44 10.68a1.25 1.25 0 0 0 1.62 0c.26-.22 6.44-5.53 6.44-10.68A7.25 7.25 0 0 0 12 2.75Z" />
              <circle cx="12" cy="10" r="2.35" />
            </svg>
            <div>
              <h2>
                <a href={googleMapsUrl} target="_blank" rel="noreferrer">
                  {content.venueName}
                </a>
              </h2>
              <p>{content.venueArea}</p>
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

          <div className={styles.practical}>
            <p>{content.bestTime}</p>
            {content.priceNote ? <p>{content.priceNote}</p> : null}
          </div>

          {chapter.status === "lived" ? (
            <p className={styles.lived}>You lived this one.</p>
          ) : chapter.status === "accepted" && chapter.scheduledFor ? (
            <div className={styles.accepted}>
              <p>{scheduledDayLabel(chapter.scheduledFor)}</p>
              {canMarkLived ? (
                <button
                  type="button"
                  className={styles.primaryAction}
                  disabled={busy}
                  onClick={() => void markLived()}
                >
                  I did this
                </button>
              ) : null}
            </div>
          ) : showDatePicker ? (
            <form
              className={styles.dateChoice}
              onSubmit={(event) => {
                event.preventDefault();
                void chooseDay();
              }}
            >
              <label>
                <span>Choose a day</span>
                <input
                  type="date"
                  min={localIsoDay()}
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                />
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.textAction}
                  disabled={busy}
                  onClick={() => setShowDatePicker(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryAction}
                  disabled={busy || !scheduledFor}
                >
                  Keep this
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.textAction}
                disabled={busy}
                onClick={() => void decline()}
              >
                Not this one
              </button>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={busy}
                onClick={() => setShowDatePicker(true)}
              >
                Choose a day
              </button>
            </div>
          )}

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </aside>
      </motion.div>
    </section>
  );
}

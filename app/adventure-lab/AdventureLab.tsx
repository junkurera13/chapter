"use client";

import { getAccessToken } from "@base44/sdk";
import Image from "next/image";
import { useMemo, useState } from "react";

import ChapterLoadingMark from "@/components/chapter-loading-mark";
import {
  adventureLabBatchSchema,
  adventureLabFeedbackSchema,
  type AdventureLabBatch,
  type AdventureLabFeedback,
  type AdventureLabFeedbackTag,
  type AdventureLabExperience,
} from "@/lib/adventureLab";

import styles from "./page.module.css";

type LabPhase = "idle" | "crafting" | "ready" | "error";

const FEEDBACK_STORAGE_KEY = "chapter:adventure-lab:feedback:v1";
const MAX_STORED_FEEDBACK = 24;

const FEEDBACK_OPTIONS: Array<{
  tag: AdventureLabFeedbackTag;
  label: string;
  tone: "positive" | "negative";
}> = [
  { tag: "would-do", label: "I’d do this", tone: "positive" },
  { tag: "feels-real", label: "Feels real", tone: "positive" },
  { tag: "good-stretch", label: "Good stretch", tone: "positive" },
  { tag: "too-generic", label: "Too generic", tone: "negative" },
  { tag: "just-a-venue", label: "Just a venue", tone: "negative" },
  { tag: "feels-made-up", label: "Feels made up", tone: "negative" },
  { tag: "too-much-effort", label: "Too much effort", tone: "negative" },
  { tag: "not-for-me", label: "Not for me", tone: "negative" },
];

const SCALE_NAMES: Record<AdventureLabExperience["id"], string> = {
  small: "Small",
  mini: "Mini",
  proper: "Proper",
};

function readFeedback() {
  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    const parsed = adventureLabFeedbackSchema
      .array()
      .max(MAX_STORED_FEEDBACK)
      .safeParse(value);
    if (parsed.success) return parsed.data;
  } catch {
    // A broken local draft should never stop the lab from opening.
  }
  window.localStorage.removeItem(FEEDBACK_STORAGE_KEY);
  return [];
}

function storeFeedback(feedback: readonly AdventureLabFeedback[]) {
  window.localStorage.setItem(
    FEEDBACK_STORAGE_KEY,
    JSON.stringify(feedback.slice(-MAX_STORED_FEEDBACK)),
  );
}

function durationLabel(experience: AdventureLabExperience) {
  const { min, max } = experience.format.durationMinutes;
  const render = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours} hr` : `${hours} hrs`;
  };
  return min === max ? render(min) : `${render(min)}–${render(max)}`;
}

function makeFeedback(
  batch: AdventureLabBatch,
  experience: AdventureLabExperience,
  tags: readonly AdventureLabFeedbackTag[],
  note: string,
) {
  return adventureLabFeedbackSchema.parse({
    batchId: batch.id,
    experienceId: experience.id,
    experienceSummary: experience.experiencePromise,
    tags,
    note,
    createdAt: Date.now(),
  });
}

function feedbackForChat(feedback: readonly AdventureLabFeedback[]) {
  if (feedback.length === 0) {
    return "I have not reviewed any Adventure Lab ideas yet.";
  }
  return [
    "Adventure Lab feedback",
    "",
    ...feedback.slice(-12).flatMap((item, index) => [
      `${index + 1}. ${SCALE_NAMES[item.experienceId]}: ${item.experienceSummary}`,
      `My reactions: ${
        item.tags.length
          ? item.tags
              .map(
                (tag) =>
                  FEEDBACK_OPTIONS.find((option) => option.tag === tag)?.label ??
                  tag,
              )
              .join(", ")
          : "none selected"
      }`,
      `My note: ${item.note || "none"}`,
      "",
    ]),
  ].join("\n");
}

async function requestBatch(feedback: readonly AdventureLabFeedback[]) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Open Chapter and sign in first.");

  const response = await fetch("/api/adventure-lab", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feedback }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    value?: unknown;
    error?: string;
  };
  const batch = adventureLabBatchSchema.safeParse(payload.value);
  if (!response.ok || !batch.success) {
    throw new Error(
      payload.error || "Chapter couldn’t craft those adventures just now.",
    );
  }
  return batch.data;
}

export default function AdventureLab() {
  const [phase, setPhase] = useState<LabPhase>("idle");
  const [batch, setBatch] = useState<AdventureLabBatch | null>(null);
  const [experienceIndex, setExperienceIndex] = useState(0);
  const [selectedTags, setSelectedTags] = useState<
    AdventureLabFeedbackTag[]
  >([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const experience = batch?.experiences[experienceIndex];
  const hasResponse = selectedTags.length > 0 || note.trim().length > 0;
  const isLast = experienceIndex === 2;
  const metadata = useMemo(
    () =>
      experience
        ? [
            durationLabel(experience),
            experience.format.effort.replace("-", " "),
            experience.format.geography.replace("-", " "),
          ]
        : [],
    [experience],
  );

  function resetResponse() {
    setSelectedTags([]);
    setNote("");
  }

  async function craft(feedback = readFeedback()) {
    setPhase("crafting");
    setMessage("");
    setCopied(false);
    try {
      const nextBatch = await requestBatch(feedback);
      setBatch(nextBatch);
      setExperienceIndex(0);
      resetResponse();
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Chapter couldn’t craft those adventures just now.",
      );
    }
  }

  function saveCurrentFeedback() {
    if (!batch || !experience || !hasResponse) return readFeedback();
    const next = [
      ...readFeedback(),
      makeFeedback(batch, experience, selectedTags, note),
    ].slice(-MAX_STORED_FEEDBACK);
    storeFeedback(next);
    return next;
  }

  function continueFromExperience(save: boolean) {
    const feedback = save ? saveCurrentFeedback() : readFeedback();
    if (isLast) {
      void craft(feedback);
      return;
    }
    setExperienceIndex((current) => current + 1);
    resetResponse();
    setCopied(false);
  }

  function toggleTag(tag: AdventureLabFeedbackTag) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((candidate) => candidate !== tag)
        : [...current, tag],
    );
  }

  async function copyFeedback() {
    try {
      await navigator.clipboard.writeText(feedbackForChat(readFeedback()));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  }

  if (phase === "idle" || phase === "error") {
    return (
      <main className={styles.page}>
        <section className={styles.intro}>
          <Image
            className={styles.mark}
            src="/chapter-mark.svg"
            alt=""
            width={88}
            height={88}
            priority
          />
          <h1>
            {phase === "error"
              ? "That set didn’t come together."
              : "Adventure lab"}
          </h1>
          <p>
            {phase === "error"
              ? message
              : "Craft three ideas from your real world, judge them one by one, then let your feedback shape the next set."}
          </p>
          <button
            className={styles.primaryAction}
            type="button"
            onClick={() => void craft()}
          >
            {phase === "error" ? "Try another set" : "Craft adventures"}
          </button>
          <span className={styles.truthLine}>
            Concepts only. No invented venues. No web research.
          </span>
        </section>
      </main>
    );
  }

  if (phase === "crafting") {
    return (
      <main className={styles.page}>
        <section className={styles.loading} aria-live="polite">
          <ChapterLoadingMark label="Crafting adventures" size={104} />
          <h1>Crafting three directions.</h1>
          <p>
            Chapter is designing the action first, then checking every idea
            against the equation.
          </p>
        </section>
      </main>
    );
  }

  if (!batch || !experience) return null;

  return (
    <main className={styles.workbench}>
      <header className={styles.header}>
        <button
          className={styles.wordmark}
          type="button"
          onClick={() => setPhase("idle")}
        >
          Adventure lab
        </button>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => void copyFeedback()}>
            {copied ? "Copied" : "Copy notes for chat"}
          </button>
          <button type="button" onClick={() => void craft()}>
            Craft another set
          </button>
        </div>
      </header>

      <section
        className={styles.experienceStage}
        key={`${batch.id}:${experience.id}`}
      >
        <div className={styles.progress} aria-label={`${experienceIndex + 1} of 3`}>
          {batch.experiences.map((item, index) => (
            <span
              key={item.id}
              data-active={index === experienceIndex}
              data-past={index < experienceIndex}
            />
          ))}
        </div>

        <article className={styles.experience}>
          <div className={styles.experienceMeta}>
            <strong>{SCALE_NAMES[experience.id]}</strong>
            {metadata.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <h1>{experience.experiencePromise}</h1>

          <div className={styles.explanation}>
            <section>
              <h2>What you actually do</h2>
              <p>{experience.mechanism.description}</p>
            </section>
            <section>
              <h2>Why this starts from you</h2>
              <p>{experience.familiarThread}</p>
            </section>
            <section>
              <h2>The new part</h2>
              <p>{experience.stretch.description}</p>
              {experience.supportingContext ? (
                <p>{experience.supportingContext.description}</p>
              ) : null}
            </section>
          </div>

          <details className={styles.realityCheck}>
            <summary>What still needs proving</summary>
            <p>{experience.researchObjective}</p>
          </details>
        </article>

        <section className={styles.feedback} aria-label="Your feedback">
          <h2>Gut reaction?</h2>
          <div className={styles.feedbackOptions}>
            {FEEDBACK_OPTIONS.map((option) => (
              <button
                key={option.tag}
                type="button"
                data-selected={selectedTags.includes(option.tag)}
                data-tone={option.tone}
                onClick={() => toggleTag(option.tag)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            maxLength={800}
            rows={3}
            aria-label="What should Chapter learn from this?"
            placeholder="Say it normally — e.g. “the action is good, but that setting sounds invented.”"
            onChange={(event) => setNote(event.target.value)}
          />
          <div className={styles.feedbackActions}>
            <button
              className={styles.skipAction}
              type="button"
              onClick={() => continueFromExperience(false)}
            >
              Skip
            </button>
            <button
              className={styles.saveAction}
              type="button"
              disabled={!hasResponse}
              onClick={() => continueFromExperience(true)}
            >
              {isLast ? "Save & craft the next set" : "Save & show the next one"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

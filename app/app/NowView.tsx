"use client";

import Image, { type StaticImageData } from "next/image";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";

import ceramicsImage from "../assets/ceramics-class.jpg";
import coastImage from "../assets/chapter-coast.jpg";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import ChapterLoadingMark from "../../components/chapter-loading-mark";

import styles from "./NowView.module.css";

type ExperienceKind = "andy" | "marco";
type ExperienceStatus = "sent" | "saved" | "passed" | "done";

const KIND_COPY: Record<ExperienceKind, {
  name: string;
  duration: string;
  description: string;
  image: StaticImageData;
}> = {
  andy: {
    name: "Andy",
    duration: "45–90 minutes",
    description: "A small opening in the day, shaped around where you are.",
    image: ceramicsImage,
  },
  marco: {
    name: "Marco",
    duration: "2–4 hours",
    description: "Enough time to follow a thread and come back with a story.",
    image: coastImage,
  },
};

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

export default function NowView() {
  const account = useQuery(api.accounts.current);
  const experiences = useQuery(api.webExperiences.listMine);
  const saveLocation = useMutation(api.accounts.saveLocation);
  const updateStatus = useMutation(api.webExperiences.updateStatus);
  const [selectedKind, setSelectedKind] = useState<ExperienceKind>("andy");
  const [location, setLocation] = useState<string | null>(null);
  const [personalCue, setPersonalCue] = useState("");
  const [constraints, setConstraints] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<Id<"accountExperiences"> | null>(null);

  const locationValue = location ??
    (account?.homeCity
      ? [account.homeArea, account.homeCity].filter(Boolean).join(", ")
      : "");

  const current = useMemo(
    () => experiences?.find((item) => item._id === selectedId) ?? experiences?.[0] ?? null,
    [experiences, selectedId],
  );

  async function generateExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generating || locationValue.trim().length < 2) return;
    setGenerating(true);
    setError(null);
    try {
      const locationParts = locationValue.split(",").map((part) => part.trim()).filter(Boolean);
      await saveLocation({
        homeCity: locationParts.at(-1) ?? locationValue.trim(),
        homeArea: locationParts.length > 1 ? locationParts.slice(0, -1).join(", ") : undefined,
      });
      const response = await fetch("/api/experience", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: selectedKind,
          location: locationValue.trim(),
          personalCue: personalCue.trim() || undefined,
          constraints: constraints.trim() || undefined,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "Chapter couldn't shape that experience.";
        throw new Error(message);
      }
      if (payload && typeof payload === "object" && "experienceId" in payload) {
        setSelectedId(String(payload.experienceId) as Id<"accountExperiences">);
      }
      setChoosing(false);
      setPersonalCue("");
      setConstraints("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chapter couldn't shape that experience.");
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(status: ExperienceStatus) {
    if (!current) return;
    setError(null);
    try {
      await updateStatus({ experienceId: current._id, status });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change didn't stick.");
    }
  }

  if (account === undefined || experiences === undefined) {
    return <div className={styles.loading}><ChapterLoadingMark label="Opening Now" /></div>;
  }

  if (generating) {
    return (
      <div className={styles.generating} aria-live="polite">
        <ChapterLoadingMark label="Chapter is looking nearby" size={76} />
        <h1>Looking for a thread worth following.</h1>
        <p>Reading local details, lived signals and what is actually open.</p>
      </div>
    );
  }

  if (!current || choosing) {
    return (
      <div className={styles.choose}>
        <div className={styles.chooseIntro}>
          <h1>What kind of time do you have?</h1>
          <p>Chapter will find one thing worth leaving the house for.</p>
        </div>
        <form className={styles.composer} onSubmit={generateExperience}>
          <div className={styles.kindGrid}>
            {(Object.keys(KIND_COPY) as ExperienceKind[]).map((kind) => {
              const copy = KIND_COPY[kind];
              return (
                <button
                  type="button"
                  className={styles.kind}
                  data-selected={selectedKind === kind}
                  key={kind}
                  onClick={() => setSelectedKind(kind)}
                >
                  <Image src={copy.image} alt="" fill sizes="(max-width: 720px) 90vw, 360px" />
                  <span className={styles.kindShade} />
                  <span className={styles.kindCopy}>
                    <strong>{copy.name}</strong>
                    <small>{copy.duration}</small>
                    <span>{copy.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.fields}>
            <label>
              <span>Where are you?</span>
              <input
                value={locationValue}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Neighborhood, city"
                required
                minLength={2}
                maxLength={140}
              />
            </label>
            <label>
              <span>A thread to follow <small>optional</small></span>
              <input
                value={personalCue}
                onChange={(event) => setPersonalCue(event.target.value)}
                placeholder="Something you've been curious about"
                maxLength={500}
              />
            </label>
            <label>
              <span>Anything to work around <small>optional</small></span>
              <input
                value={constraints}
                onChange={(event) => setConstraints(event.target.value)}
                placeholder="Budget, mobility, weather…"
                maxLength={500}
              />
            </label>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.submitRow}>
            {current ? <button type="button" className={styles.cancel} onClick={() => setChoosing(false)}>Back</button> : null}
            <button type="submit" className={styles.submit}>Make me a {KIND_COPY[selectedKind].name}</button>
          </div>
        </form>
      </div>
    );
  }

  const experience = current.experience;
  const image = KIND_COPY[experience.kind].image;
  return (
    <article className={styles.experience}>
      <div className={styles.hero}>
        <Image src={image} alt="" fill priority sizes="100vw" />
        <div className={styles.heroShade} />
        <div className={styles.heroCopy}>
          <div className={styles.meta}>
            <span>{KIND_COPY[experience.kind].name}</span>
            <span>{durationLabel(experience.durationMinutes)}</span>
          </div>
          <h1>{experience.title}</h1>
          <p>{experience.summary}</p>
        </div>
      </div>

      <div className={styles.story}>
        <section className={styles.route} aria-label="Experience plan">
          {experience.stops.map((stop, index) => (
            <article className={styles.stop} key={`${stop.name}-${index}`}>
              <span className={styles.stopNumber}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{stop.name}</h2>
                <p>{stop.activity}</p>
                <dl>
                  <div><dt>Where</dt><dd>{stop.address}</dd></div>
                  <div><dt>When</dt><dd>{stop.hours}</dd></div>
                  <div><dt>Cost</dt><dd>{stop.price}</dd></div>
                </dl>
              </div>
            </article>
          ))}
        </section>

        <aside className={styles.details}>
          <div><h2>Getting there</h2><p>{experience.gettingThere}</p></div>
          {experience.booking ? <div><h2>Booking</h2><p>{experience.booking}</p></div> : null}
          {experience.whatToBring ? <div><h2>Bring</h2><p>{experience.whatToBring}</p></div> : null}
          <div><h2>Why this one</h2><p>{experience.whyThisFits}</p></div>
          <div className={styles.sources}>
            <h2>Checked sources</h2>
            {experience.sources.map((source) => (
              <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label}</a>
            ))}
          </div>
        </aside>
      </div>

      {error ? <p className={styles.resultError} role="alert">{error}</p> : null}
      <div className={styles.actions}>
        <button type="button" data-active={current.status === "saved"} onClick={() => void setStatus("saved")}>Save</button>
        <button type="button" data-active={current.status === "done"} onClick={() => void setStatus("done")}>I did this</button>
        <button type="button" data-active={current.status === "passed"} onClick={() => void setStatus("passed")}>Pass</button>
        <button type="button" className={styles.newExperience} onClick={() => setChoosing(true)}>Find another</button>
      </div>

      {experiences.length > 1 ? (
        <nav className={styles.history} aria-label="Past experiences">
          {experiences.slice(0, 8).map((item) => (
            <button type="button" data-active={item._id === current._id} key={item._id} onClick={() => setSelectedId(item._id)}>
              <span>{KIND_COPY[item.kind].name}</span>
              {item.experience.title}
            </button>
          ))}
        </nav>
      ) : null}
    </article>
  );
}

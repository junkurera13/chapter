"use client";

import { getAccessToken } from "@base44/sdk";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import WeeklyPackView from "@/app/app/WeeklyPackView";
import ChapterLoadingMark from "@/components/chapter-loading-mark";
import type { WeeklyExperiencePack } from "@/lib/weeklyPackSchema";

import styles from "./page.module.css";

type GeneratorPhase =
  | "idle"
  | "designing"
  | "researching"
  | "composing"
  | "ready"
  | "error";

type GeneratorState = {
  phase: GeneratorPhase;
  pack?: WeeklyExperiencePack;
  message?: string;
};

type GeneratorResponse =
  | { status: "researching"; jobToken: string }
  | { status: "ready-to-compose"; jobToken: string }
  | { status: "ready"; pack: WeeklyExperiencePack };

const PHASE_COPY: Record<
  Exclude<GeneratorPhase, "idle" | "ready" | "error">,
  { label: string; title: string; body: string }
> = {
  designing: {
    label: "Designing",
    title: "Finding three honest directions.",
    body: "Chapter is reading the living threads in your world and shaping a real choice.",
  },
  researching: {
    label: "Researching",
    title: "Making each one real.",
    body: "Three independent searches are checking places, timing, travel, cost, and practical details.",
  },
  composing: {
    label: "Finishing",
    title: "Putting the cards together.",
    body: "The experiences passed research. Chapter is writing the invitations and creating their images.",
  },
};

async function generatorRequest(
  accessToken: string,
  body: Record<string, string>,
  signal: AbortSignal,
) {
  const response = await fetch("/api/experience-generator", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    value?: GeneratorResponse;
    error?: string;
  };
  if (!response.ok || !payload.value) {
    throw new Error(
      payload.error || "Chapter couldn’t generate those experiences.",
    );
  }
  return payload.value;
}

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    function onAbort() {
      window.clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    }
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export default function ExperienceGeneratorHarness() {
  const [state, setState] = useState<GeneratorState>({ phase: "idle" });
  const activeRun = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRun.current?.abort();
    },
    [],
  );

  async function generate() {
    activeRun.current?.abort();
    const controller = new AbortController();
    activeRun.current = controller;
    setState({ phase: "designing" });

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Open Chapter and sign in first.");
      }
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const started = await generatorRequest(
        accessToken,
        { action: "start", timezone },
        controller.signal,
      );
      if (started.status !== "researching") {
        throw new Error("The generator returned an unexpected state.");
      }

      setState({ phase: "researching" });
      let jobToken = started.jobToken;
      for (;;) {
        await wait(5_000, controller.signal);
        const polled = await generatorRequest(
          accessToken,
          { action: "poll", jobToken },
          controller.signal,
        );
        if (polled.status === "researching") {
          jobToken = polled.jobToken;
          continue;
        }
        if (polled.status !== "ready-to-compose") {
          throw new Error("The generator returned an unexpected state.");
        }
        jobToken = polled.jobToken;
        break;
      }

      setState({ phase: "composing" });
      const finished = await generatorRequest(
        accessToken,
        { action: "finish", jobToken },
        controller.signal,
      );
      if (finished.status !== "ready") {
        throw new Error("The generator returned an unexpected state.");
      }
      setState({ phase: "ready", pack: finished.pack });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "Chapter couldn’t generate those experiences.",
      });
    }
  }

  const working =
    state.phase === "designing" ||
    state.phase === "researching" ||
    state.phase === "composing";
  const phaseCopy =
    state.phase === "designing" ||
    state.phase === "researching" ||
    state.phase === "composing"
      ? PHASE_COPY[state.phase]
      : undefined;

  return (
    <main className={styles.page} data-phase={state.phase}>
      {state.phase === "ready" && state.pack ? (
        <WeeklyPackView
          key={state.pack.id}
          reviewState="sealed"
          reviewPack={state.pack}
        />
      ) : (
        <section className={styles.stage} aria-live="polite">
          {working && phaseCopy ? (
            <div className={styles.working}>
              <ChapterLoadingMark label={phaseCopy.label} size={104} />
              <div className={styles.copy}>
                <p className={styles.eyebrow}>{phaseCopy.label}</p>
                <h1>{phaseCopy.title}</h1>
                <p>{phaseCopy.body}</p>
              </div>
            </div>
          ) : (
            <div className={styles.intro}>
              <Image
                className={styles.mark}
                src="/chapter-mark.svg"
                alt=""
                width={88}
                height={88}
                priority
              />
              <div className={styles.copy}>
                <h1>
                  {state.phase === "error"
                    ? "The set didn’t come together."
                    : "Experience generator"}
                </h1>
                <p>
                  {state.phase === "error"
                    ? state.message
                    : "Create a live, researched three-card pack from your current world. Nothing is saved."}
                </p>
              </div>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => void generate()}
              >
                {state.phase === "error"
                  ? "Try again"
                  : "Generate experiences"}
              </button>
            </div>
          )}
        </section>
      )}

      <aside className={styles.toolbar} aria-label="Experience generator">
        <span className={styles.statusDot} data-working={working} />
        <span className={styles.toolbarLabel}>
          <small>Now review</small>
          <strong>
            {state.phase === "ready"
              ? "Generated pack"
              : working && phaseCopy
                ? phaseCopy.label
                : "Experience generator"}
          </strong>
        </span>

        {state.phase === "ready" ? (
          <>
            <span className={styles.divider} aria-hidden="true" />
            <button
              type="button"
              className={styles.generateAgain}
              onClick={() => void generate()}
            >
              Generate again
            </button>
          </>
        ) : null}

        <span className={styles.divider} aria-hidden="true" />
        <button
          type="button"
          className={styles.exit}
          aria-label="Exit experience generator"
          onClick={() => window.location.assign("/app?view=now")}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <path d="m5.5 5.5 9 9m0-9-9 9" />
          </svg>
        </button>
      </aside>
    </main>
  );
}

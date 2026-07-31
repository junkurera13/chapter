"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNavigation, {
  type ChapterTabIndex,
} from "./BottomNavigation";
import type { AuthenticatedViewer } from "../../lib/base44Auth";
import { loadMyExperienceGraph } from "../../lib/base44Graph";
import type { ExperienceGraphRecord } from "../../lib/backendTypes";
import AgentOrbVideo from "../../components/landing/agent-orb-video";
import ChapterLoadingMark from "../../components/chapter-loading-mark";
import { buildWorldGraph } from "./graphData";
import NowLocationNode from "./NowLocationNode";
import TogetherView from "./TogetherView";
import WeeklyPackReviewToolbar from "./WeeklyPackReviewToolbar";
import WeeklyPackView from "./WeeklyPackView";
import WelcomeDialog from "../../components/welcome-dialog";
import YouOnboarding from "./YouOnboarding";
import YouView from "./YouView";
import styles from "./page.module.css";
import { showsDemoWeeklyPack } from "../../lib/weeklyPackDemoAccess";
import type { WeeklyPackReviewState } from "../../lib/weeklyPackPreview";

type GraphState =
  | { status: "loading" }
  | { status: "ready"; graph: ExperienceGraphRecord }
  | { status: "error" };

const GRAPH_RETRY_MS = 5000;

/** What each tab calls itself in the address bar, by index. */
const TAB_VIEWS = ["you", "now", "together"] as const;

export default function ChapterApp({
  viewer,
  initialGraph,
  onConnectPhone,
  initialTab = 0,
  justConnected = false,
  initialWeeklyPackReview,
}: {
  viewer: AuthenticatedViewer;
  initialGraph: ExperienceGraphRecord;
  onConnectPhone: () => void;
  initialTab?: ChapterTabIndex;
  /** Arrived here by accepting an invitation moments ago. */
  justConnected?: boolean;
  initialWeeklyPackReview?: WeeklyPackReviewState;
}) {
  const canReviewNow = process.env.NODE_ENV === "development";
  const [activeIndex, setActiveIndex] = useState<ChapterTabIndex>(initialTab);
  const [weeklyPackReview, setWeeklyPackReview] = useState<
    WeeklyPackReviewState | undefined
  >(canReviewNow ? initialWeeklyPackReview : undefined);
  const [addingMemory, setAddingMemory] = useState(false);
  /**
   * A memory that has been sent and is still being read. It is a state of the
   * world, not of a screen, so it lives out here where the world does — the
   * composer that sent it is long gone by the time this clears.
   */
  const [extracting, setExtracting] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [graphState, setGraphState] = useState<GraphState>({
    status: "ready",
    graph: initialGraph,
  });
  const worldLocked =
    graphState.status !== "ready" || graphState.graph.memoryCount === 0;
  const displayedIndex = worldLocked ? 0 : activeIndex;
  const worldGraph = useMemo(
    () =>
      graphState.status === "ready" && graphState.graph.nodes.length > 0
        ? buildWorldGraph(graphState.graph)
        : null,
    [graphState],
  );

  const queueGraphLoad = useCallback(() => {
    setGraphState({ status: "loading" });
  }, []);
  /**
   * The tab you are on is written into the address, so reloading puts you back
   * where you were standing rather than at the top of your world. Replacing
   * rather than pushing: moving between tabs is looking around one place, not
   * travelling, and Back should still leave the app the way it always did.
   */
  const changeTab = useCallback(
    (nextIndex: ChapterTabIndex) => {
      if (worldLocked && nextIndex !== 0) return;
      setActiveIndex(nextIndex);
      if (nextIndex !== 1) setWeeklyPackReview(undefined);

      const url = new URL(window.location.href);
      url.searchParams.set("view", TAB_VIEWS[nextIndex]);
      if (nextIndex !== 1) url.searchParams.delete("review");
      url.searchParams.delete("pack");
      // The invitation flag is true of an arrival, not of the page. It goes
      // the first time you move, so a reload can't replay the welcome.
      url.searchParams.delete("joined");
      window.history.replaceState(null, "", url);
    },
    [worldLocked],
  );

  const changeWeeklyPackReview = useCallback(
    (nextState: WeeklyPackReviewState) => {
      if (!canReviewNow) return;
      setActiveIndex(1);
      setWeeklyPackReview(nextState);

      const url = new URL(window.location.href);
      url.searchParams.set("view", "now");
      url.searchParams.set("review", nextState);
      url.searchParams.delete("joined");
      url.searchParams.delete("pack");
      window.history.replaceState(null, "", url);
    },
    [canReviewNow],
  );

  const exitWeeklyPackReview = useCallback(() => {
    setWeeklyPackReview(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("review");
    url.searchParams.delete("pack");
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (graphState.status !== "loading") return;

    let active = true;

    async function openGraph() {
      try {
        const graph = await loadMyExperienceGraph();
        if (active) {
          setGraphState({ status: "ready", graph });
          if (graph.memoryCount === 0) setActiveIndex(0);
        }
      } catch (error) {
        console.error("Could not load the Chapter experience graph", error);
        if (active) setGraphState({ status: "error" });
      }
    }

    void openGraph();

    return () => {
      active = false;
    };
  }, [graphState.status]);

  /*
   * Escape closes the composer, and nothing else does except the button that
   * says so. A half-written memory is too easy to lose to a stray click on the
   * world behind it.
   */
  useEffect(() => {
    if (!addingMemory) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddingMemory(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [addingMemory]);

  useEffect(() => {
    if (graphState.status !== "error") return;

    const retry = window.setTimeout(queueGraphLoad, GRAPH_RETRY_MS);
    return () => window.clearTimeout(retry);
  }, [graphState.status, queueGraphLoad]);

  let youPanel;
  if (graphState.status === "loading") {
    youPanel = (
      <div className={styles.graphLoading} aria-busy="true">
        <ChapterLoadingMark label="Opening your world" />
      </div>
    );
  } else if (graphState.status === "error") {
    youPanel = (
      <div className={styles.graphState} role="alert">
        <h1>Your world couldn&apos;t open.</h1>
        <button type="button" onClick={queueGraphLoad}>
          Try again
        </button>
      </div>
    );
  } else if (graphState.graph.memoryCount === 0) {
    youPanel = (
      <YouOnboarding
        onMemoryCreated={() => {
          // Their world is the payoff for sending a first memory. Now joins
          // the normal Saturday ritual instead of starting a separate paid
          // experience during onboarding.
          setActiveIndex(0);
          const url = new URL(window.location.href);
          url.searchParams.set("view", "you");
          url.searchParams.delete("joined");
          window.history.replaceState(null, "", url);
          queueGraphLoad();
        }}
      />
    );
  } else if (!worldGraph) {
    youPanel = (
      <div className={styles.graphLoading} aria-busy="true">
        <ChapterLoadingMark label="Shaping your world" />
      </div>
    );
  } else {
    youPanel = (
      <>
        <YouView nodes={worldGraph.nodes} edges={worldGraph.edges} />
        {/*
          The two things you do to your own world, together in the middle of
          it: look for something already there, or put something new in.
        */}
        <div className={styles.worldControls}>
          <button
            type="button"
            className={styles.worldSearch}
            aria-label="Search your world"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <circle cx="9" cy="9" r="5.25" />
              <path d="m12.9 12.9 3.1 3.1" />
            </svg>
          </button>

          {/*
            One or the other, never both. While Chapter is still reading the
            last one there is nothing to press: the orb standing where the
            button was is the answer to "did that send?".
          */}
          {extracting ? (
            <p className={styles.extracting} role="status" aria-live="polite">
              <span className={styles.extractingOrb} aria-hidden="true">
                <AgentOrbVideo
                  src="/you-agent-orb.mp4"
                  poster="/you-agent-orb-poster.jpg"
                  playWhileMounted
                  preload="auto"
                />
              </span>
              Extracting
            </p>
          ) : (
            <button
              type="button"
              className={styles.addMemoryButton}
              onClick={() => setAddingMemory(true)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M10 4.5v11M4.5 10h11" />
              </svg>
              New Memory
            </button>
          )}
        </div>
      </>
    );
  }

  /*
    A demo pack stands in for this account's own, so the Saturday flow can be
    shown on a day that is not Saturday. It is three sealed sample cards and
    nothing else: the flip, the choice, and the day that follow are the real
    interface doing its real work. Stepping through every state by hand is a
    separate, development-only thing, and it wins if both are somehow on.
  */
  const demoPack = showsDemoWeeklyPack(viewer.email) && !weeklyPackReview;

  const activePanel =
    displayedIndex === 1 ? (
      <>
        <WeeklyPackView
          key={weeklyPackReview ?? (demoPack ? "demo" : "live")}
          reviewState={weeklyPackReview ?? (demoPack ? "sealed" : undefined)}
          onReviewStateChange={demoPack ? undefined : changeWeeklyPackReview}
        />
        <NowLocationNode />
      </>
    ) : displayedIndex === 2 ? (
      <TogetherView
        nodes={worldGraph?.nodes ?? []}
        onOpenYou={() => changeTab(0)}
        onGraphAdvanced={queueGraphLoad}
      />
    ) : (
      youPanel
    );

  return (
    <main className={styles.canvas} aria-label="Chapter app">
      <section
        className={styles.panel}
        id={`chapter-panel-${displayedIndex}`}
        role="tabpanel"
        aria-labelledby={`chapter-tab-${displayedIndex}`}
      >
        {activePanel}
      </section>

      {/*
        Adding to a world that already exists doesn't send you back to the
        beginning of one. The world stays where it was, blurred behind a
        window with nothing in it but the composer.
      */}
      {addingMemory ? (
        <div
          className={styles.memoryScrim}
          role="dialog"
          aria-modal="true"
          aria-label="Add a memory"
        >
          {/* Outside the window, so a long memory can never scroll it away. */}
          <button
            type="button"
            className={styles.memoryClose}
            aria-label="Close"
            onClick={() => setAddingMemory(false)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
            </svg>
          </button>

          <div className={styles.memoryWindow}>
            <YouOnboarding
              composerOnly
              onMemoryCreated={queueGraphLoad}
              onSubmitStarted={(work) => {
                setAddingMemory(false);
                setExtracting(true);
                void work
                  .catch((error) => {
                    console.error("Could not create the memory map", error);
                  })
                  .finally(() => {
                    setExtracting(false);
                    queueGraphLoad();
                  });
              }}
            />
          </div>
        </div>
      ) : null}

      {/*
        Someone who just accepted an invitation and has no memory yet is sent
        to write one. This says why, once, before the screen behind it.
      */}
      {justConnected && worldLocked && !welcomeDismissed ? (
        <WelcomeDialog
          message="You’re connected — add one memory and Chapter can plan something for the two of you."
          onDismiss={() => setWelcomeDismissed(true)}
        />
      ) : null}

      {displayedIndex === 1 && weeklyPackReview ? (
        <WeeklyPackReviewToolbar
          state={weeklyPackReview}
          onChange={changeWeeklyPackReview}
          onExit={exitWeeklyPackReview}
        />
      ) : null}

      <BottomNavigation
        activeIndex={displayedIndex}
        onChange={changeTab}
        worldLocked={worldLocked}
        viewer={viewer}
        onConnectPhone={onConnectPhone}
        canReviewNow={canReviewNow}
        onReviewNow={() => changeWeeklyPackReview("sealed")}
      />
    </main>
  );
}

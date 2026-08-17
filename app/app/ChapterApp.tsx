"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../convex/_generated/api";
import type { ExperienceGraphRecord } from "../../lib/backendTypes";
import AgentOrbVideo from "../../components/landing/agent-orb-video";
import ChapterLoadingMark from "../../components/chapter-loading-mark";
import WelcomeDialog from "../../components/welcome-dialog";
import BottomNavigation, { type ChapterTabIndex } from "./BottomNavigation";
import { buildWorldGraph } from "./graphData";
import NowView from "./NowView";
import TogetherView from "./TogetherView";
import YouOnboarding from "./YouOnboarding";
import YouView from "./YouView";
import styles from "./page.module.css";

const TAB_VIEWS = ["you", "now", "together"] as const;

export default function ChapterApp({
  initialTab = 0,
  justConnected = false,
}: {
  initialTab?: ChapterTabIndex;
  justConnected?: boolean;
}) {
  const liveGraph = useQuery(api.webMemory.graph);
  const [activeIndex, setActiveIndex] = useState<ChapterTabIndex>(initialTab);
  const [addingMemory, setAddingMemory] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const graph = liveGraph as ExperienceGraphRecord | undefined;
  const worldLocked = graph === undefined || graph.memoryCount === 0;
  const displayedIndex = worldLocked ? 0 : activeIndex;
  const worldGraph = useMemo(
    () => graph && graph.nodes.length > 0 ? buildWorldGraph(graph) : null,
    [graph],
  );

  const changeTab = useCallback((nextIndex: ChapterTabIndex) => {
    if (worldLocked && nextIndex !== 0) return;
    setActiveIndex(nextIndex);
    const url = new URL(window.location.href);
    url.searchParams.set("view", TAB_VIEWS[nextIndex]);
    url.searchParams.delete("tab");
    url.searchParams.delete("joined");
    window.history.replaceState(null, "", url);
  }, [worldLocked]);

  useEffect(() => {
    if (!addingMemory) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddingMemory(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [addingMemory]);

  let youPanel;
  if (graph === undefined) {
    youPanel = (
      <div className={styles.graphLoading} aria-busy="true">
        <ChapterLoadingMark label="Opening your world" />
      </div>
    );
  } else if (graph.memoryCount === 0) {
    youPanel = (
      <YouOnboarding
        onMemoryCreated={() => {
          setActiveIndex(0);
          const url = new URL(window.location.href);
          url.searchParams.set("view", "you");
          url.searchParams.delete("joined");
          window.history.replaceState(null, "", url);
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
        <div className={styles.worldControls}>
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
            <button type="button" className={styles.addMemoryButton} onClick={() => setAddingMemory(true)}>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M10 4.5v11M4.5 10h11" />
              </svg>
              New Memory
            </button>
          )}
        </div>
      </>
    );
  }

  const activePanel = displayedIndex === 1
    ? <NowView />
    : displayedIndex === 2
      ? <TogetherView />
      : youPanel;

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

      {addingMemory ? (
        <div className={styles.memoryScrim} role="dialog" aria-modal="true" aria-label="Add a memory">
          <button type="button" className={styles.memoryClose} aria-label="Close" onClick={() => setAddingMemory(false)}>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
            </svg>
          </button>
          <div className={styles.memoryWindow}>
            <YouOnboarding
              composerOnly
              onMemoryCreated={() => setAddingMemory(false)}
              onSubmitStarted={(work) => {
                setAddingMemory(false);
                setExtracting(true);
                void work.catch((error) => {
                  console.error("Could not create the memory map", error);
                }).finally(() => setExtracting(false));
              }}
            />
          </div>
        </div>
      ) : null}

      {justConnected && worldLocked && !welcomeDismissed ? (
        <WelcomeDialog
          message="You’re connected — add one memory and Chapter can plan something for the two of you."
          onDismiss={() => setWelcomeDismissed(true)}
        />
      ) : null}

      <BottomNavigation activeIndex={displayedIndex} onChange={changeTab} worldLocked={worldLocked} />
    </main>
  );
}

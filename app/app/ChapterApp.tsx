"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../convex/_generated/api";
import type { ExperienceGraphRecord } from "../../lib/backendTypes";
import AgentOrbVideo from "../../components/landing/agent-orb-video";
import ChapterLoadingMark from "../../components/chapter-loading-mark";
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
}: {
  initialTab?: ChapterTabIndex;
}) {
  const liveGraph = useQuery(api.webMemory.graph);
  const [activeIndex, setActiveIndex] = useState<ChapterTabIndex>(initialTab);
  const [addingMemory, setAddingMemory] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [searchingWorld, setSearchingWorld] = useState(false);
  const graph = liveGraph as ExperienceGraphRecord | undefined;
  const displayedIndex = activeIndex;
  const worldGraph = useMemo(
    () => graph && graph.nodes.length > 0 ? buildWorldGraph(graph) : null,
    [graph],
  );

  const changeTab = useCallback((nextIndex: ChapterTabIndex) => {
    setActiveIndex(nextIndex);
    if (nextIndex !== 0) setSearchingWorld(false);
    const url = new URL(window.location.href);
    url.searchParams.set("view", TAB_VIEWS[nextIndex]);
    url.searchParams.delete("tab");
    url.searchParams.delete("joined");
    window.history.replaceState(null, "", url);
  }, []);

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
      <YouView
        nodes={[]}
        edges={[]}
        searchOpen={searchingWorld}
        onSearchClose={() => setSearchingWorld(false)}
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
      <YouView
        nodes={worldGraph.nodes}
        edges={worldGraph.edges}
        searchOpen={searchingWorld}
        onSearchClose={() => setSearchingWorld(false)}
      />
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

      {displayedIndex === 0 && graph !== undefined ? (
        <div className={styles.worldControls}>
          <button
            type="button"
            className={styles.worldSearch}
            aria-label="Search your world"
            aria-pressed={searchingWorld}
            onClick={() => setSearchingWorld((open) => !open)}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <circle cx="8.7" cy="8.7" r="4.7" />
              <path d="m12.2 12.2 3.8 3.8" />
            </svg>
          </button>
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
            <button type="button" className={styles.addMemoryButton} onClick={() => {
              setSearchingWorld(false);
              setAddingMemory(true);
            }}>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M10 4.5v11M4.5 10h11" />
              </svg>
              New Memory
            </button>
          )}
        </div>
      ) : null}

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

      <BottomNavigation activeIndex={displayedIndex} onChange={changeTab} />
    </main>
  );
}

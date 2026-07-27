"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNavigation, {
  type ChapterTabIndex,
} from "./BottomNavigation";
import type { AuthenticatedViewer } from "../../lib/base44Auth";
import { loadMyExperienceGraph } from "../../lib/base44Graph";
import type { ExperienceGraphRecord } from "../../lib/backendTypes";
import ChapterLoadingMark from "../../components/chapter-loading-mark";
import { buildWorldGraph } from "./graphData";
import NowView from "./NowView";
import TogetherView from "./TogetherView";
import YouOnboarding from "./YouOnboarding";
import YouView from "./YouView";
import styles from "./page.module.css";

type GraphState =
  | { status: "loading" }
  | { status: "ready"; graph: ExperienceGraphRecord }
  | { status: "error" };

const GRAPH_RETRY_MS = 5000;

export default function ChapterApp({
  viewer,
  initialGraph,
  onConnectPhone,
  initialTab = 0,
  justConnected = false,
}: {
  viewer: AuthenticatedViewer;
  initialGraph: ExperienceGraphRecord;
  onConnectPhone: () => void;
  initialTab?: ChapterTabIndex;
  /** Arrived here by accepting an invitation moments ago. */
  justConnected?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<ChapterTabIndex>(initialTab);
  const [addingMemory, setAddingMemory] = useState(false);
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
  const changeTab = useCallback(
    (nextIndex: ChapterTabIndex) => {
      if (worldLocked && nextIndex !== 0) return;
      setActiveIndex(nextIndex);
    },
    [worldLocked],
  );

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
        onMemoryCreated={queueGraphLoad}
        welcome={
          justConnected
            ? "You’re connected. Share one memory and Chapter can start planning something for the two of you."
            : undefined
        }
      />
    );
  } else if (addingMemory) {
    youPanel = (
      <YouOnboarding
        onMemoryCreated={() => {
          setAddingMemory(false);
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
        <button
          type="button"
          className={styles.addMemoryButton}
          onClick={() => setAddingMemory(true)}
        >
          + Memory
        </button>
      </>
    );
  }

  const activePanel =
    displayedIndex === 1 ? (
      <NowView onGraphAdvanced={queueGraphLoad} />
    ) : displayedIndex === 2 ? (
      <TogetherView onOpenYou={() => changeTab(0)} />
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

      <BottomNavigation
        activeIndex={displayedIndex}
        onChange={changeTab}
        worldLocked={worldLocked}
        viewer={viewer}
        onConnectPhone={onConnectPhone}
      />
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNavigation, {
  type SidequestTabIndex,
} from "./BottomNavigation";
import type { AuthenticatedViewer } from "../../lib/base44Auth";
import { loadMyExperienceGraph } from "../../lib/base44Graph";
import type { ExperienceGraphRecord } from "../../lib/backendTypes";
import { buildWorldGraph } from "./graphData";
import ChatView from "./ChatView";
import TogetherView from "./TogetherView";
import YouView from "./YouView";
import styles from "./page.module.css";

type GraphState =
  | { status: "loading" }
  | { status: "ready"; graph: ExperienceGraphRecord }
  | { status: "error" };

export default function SidequestApp({
  viewer,
  onConnectPhone,
  initialTab = 1,
}: {
  viewer: AuthenticatedViewer;
  onConnectPhone: () => void;
  initialTab?: SidequestTabIndex;
}) {
  const [activeIndex, setActiveIndex] = useState<SidequestTabIndex>(initialTab);
  const [graphState, setGraphState] = useState<GraphState>({ status: "loading" });
  const worldGraph = useMemo(
    () =>
      graphState.status === "ready" && graphState.graph.nodes.length > 0
        ? buildWorldGraph(graphState.graph)
        : null,
    [graphState],
  );

  const loadGraph = useCallback(async () => {
    setGraphState({ status: "loading" });
    try {
      const graph = await loadMyExperienceGraph();
      setGraphState({ status: "ready", graph });
    } catch (error) {
      console.error("Could not load the Sidequest experience graph", error);
      setGraphState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function refreshGraph() {
      try {
        const graph = await loadMyExperienceGraph();
        if (active) setGraphState({ status: "ready", graph });
      } catch (error) {
        console.error("Could not load the Sidequest experience graph", error);
        if (active) setGraphState({ status: "error" });
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshGraph();
    }

    void refreshGraph();
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  let youPanel = null;
  if (activeIndex === 1) {
    if (graphState.status === "loading") {
      youPanel = (
        <div className={styles.graphLoading} aria-label="Opening your world">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sidequest-mark.svg" alt="" width={96} height={96} />
        </div>
      );
    } else if (graphState.status === "error") {
      youPanel = (
        <div className={styles.graphState} role="alert">
          <p className={styles.graphEyebrow}>The door stuck</p>
          <h1>Your world couldn&apos;t open.</h1>
          <button type="button" onClick={() => void loadGraph()}>
            Try again
          </button>
        </div>
      );
    } else if (!worldGraph) {
      youPanel = (
        <div className={styles.graphState}>
          <h1>Your world is waiting.</h1>
          <p>Talk to Sidequest in Now and it will begin taking shape here.</p>
          <button type="button" onClick={() => setActiveIndex(0)}>
            Go to Now
          </button>
        </div>
      );
    } else {
      youPanel = <YouView nodes={worldGraph.nodes} edges={worldGraph.edges} />;
    }
  }

  const activePanel =
    activeIndex === 0 ? (
      <ChatView
        viewer={viewer}
        onConnectPhone={onConnectPhone}
        onConversationAdvanced={loadGraph}
      />
    ) : activeIndex === 2 ? (
      <TogetherView onOpenYou={() => setActiveIndex(1)} />
    ) : (
      youPanel
    );

  return (
    <main className={styles.canvas} aria-label="Sidequest app">
      <section
        className={styles.panel}
        id={`sidequest-panel-${activeIndex}`}
        role="tabpanel"
        aria-labelledby={`sidequest-tab-${activeIndex}`}
      >
        {activePanel}
      </section>

      <BottomNavigation
        activeIndex={activeIndex}
        onChange={setActiveIndex}
        viewer={viewer}
        onConnectPhone={onConnectPhone}
      />
    </main>
  );
}

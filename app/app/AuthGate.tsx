"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearBase44Session,
  hasBase44Session,
  isBase44AuthError,
  loadMyBase44Session,
  type AuthenticatedViewer,
} from "@/lib/base44Auth";
import { loadMyExperienceGraph } from "@/lib/base44Graph";
import type { ExperienceGraphRecord } from "@/lib/backendTypes";
import ChapterLoadingMark from "@/components/chapter-loading-mark";

import ChapterApp from "./ChapterApp";
import PhoneConnection from "./PhoneConnection";
import type { ChapterTabIndex } from "./BottomNavigation";
import type { WeeklyPackPreviewMode } from "@/lib/weeklyPackPreview";
import styles from "./AuthGate.module.css";

type GateState =
  | { status: "checking" }
  | {
      status: "ready";
      viewer: AuthenticatedViewer;
      graph: ExperienceGraphRecord;
    }
  | { status: "error" };

export default function AuthGate({
  initialTab,
  justConnected,
  weeklyPackPreview,
}: {
  initialTab?: ChapterTabIndex;
  justConnected?: boolean;
  weeklyPackPreview?: WeeklyPackPreviewMode;
}) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ status: "checking" });
  const [phoneConnectionOpen, setPhoneConnectionOpen] = useState(false);

  async function resolveApp() {
    if (!hasBase44Session()) {
      router.replace("/?auth=1");
      return null;
    }

    try {
      const [viewer, graph] = await Promise.all([
        loadMyBase44Session(),
        loadMyExperienceGraph(),
      ]);
      return { viewer, graph };
    } catch (error) {
      if (isBase44AuthError(error)) {
        clearBase44Session();
        router.replace("/?auth=1");
        return null;
      }

      console.error("Could not open the Chapter session", error);
      throw error;
    }
  }

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const app = await resolveApp();
        if (active && app) setState({ status: "ready", ...app });
      } catch {
        if (active) setState({ status: "error" });
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
    // `resolveApp` intentionally reads the current browser token once on
    // mount. Router is the only reactive dependency in that boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function retry() {
    setState({ status: "checking" });
    try {
      const app = await resolveApp();
      if (app) setState({ status: "ready", ...app });
    } catch {
      setState({ status: "error" });
    }
  }

  if (state.status === "ready") {
    if (!state.viewer.messagingConnected && phoneConnectionOpen) {
      return (
        <PhoneConnection
          viewer={state.viewer}
          onConnected={(viewer) =>
            setState({ status: "ready", viewer, graph: state.graph })
          }
          onSkip={() => setPhoneConnectionOpen(false)}
        />
      );
    }
    return (
      <ChapterApp
        viewer={state.viewer}
        initialGraph={state.graph}
        onConnectPhone={() => setPhoneConnectionOpen(true)}
        initialTab={initialTab}
        justConnected={justConnected}
        weeklyPackPreview={weeklyPackPreview}
      />
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.statePage}>
        <div className={styles.stateCard}>
          <h1>Your world is still here.</h1>
          <p>Chapter couldn&apos;t reach it just now. Try opening it again.</p>
          <button type="button" onClick={() => void retry()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.statePage} aria-live="polite" aria-busy="true">
      <ChapterLoadingMark label="Opening Chapter" />
    </main>
  );
}

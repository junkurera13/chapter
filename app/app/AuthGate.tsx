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
import SidequestLoadingMark from "@/components/sidequest-loading-mark";

import SidequestApp from "./SidequestApp";
import PhoneConnection from "./PhoneConnection";
import type { SidequestTabIndex } from "./BottomNavigation";
import styles from "./AuthGate.module.css";

type GateState =
  | { status: "checking" }
  | { status: "ready"; viewer: AuthenticatedViewer }
  | { status: "error" };

export default function AuthGate({
  initialTab,
}: {
  initialTab?: SidequestTabIndex;
}) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ status: "checking" });
  const [phoneConnectionOpen, setPhoneConnectionOpen] = useState(false);

  async function resolveSession() {
    if (!hasBase44Session()) {
      router.replace("/?auth=1");
      return null;
    }

    try {
      return await loadMyBase44Session();
    } catch (error) {
      if (isBase44AuthError(error)) {
        clearBase44Session();
        router.replace("/?auth=1");
        return null;
      }

      console.error("Could not open the Sidequest session", error);
      throw error;
    }
  }

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const viewer = await resolveSession();
        if (active && viewer) setState({ status: "ready", viewer });
      } catch {
        if (active) setState({ status: "error" });
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
    // `resolveSession` intentionally reads the current browser token once on
    // mount. Router is the only reactive dependency in that boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function retry() {
    setState({ status: "checking" });
    try {
      const viewer = await resolveSession();
      if (viewer) setState({ status: "ready", viewer });
    } catch {
      setState({ status: "error" });
    }
  }

  if (state.status === "ready") {
    if (!state.viewer.messagingConnected && phoneConnectionOpen) {
      return (
        <PhoneConnection
          viewer={state.viewer}
          onConnected={(viewer) => setState({ status: "ready", viewer })}
          onSkip={() => setPhoneConnectionOpen(false)}
        />
      );
    }
    return (
      <SidequestApp
        viewer={state.viewer}
        onConnectPhone={() => setPhoneConnectionOpen(true)}
        initialTab={initialTab}
      />
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.statePage}>
        <div className={styles.stateCard}>
          <h1>Your world is still here.</h1>
          <p>Sidequest couldn&apos;t reach it just now. Try opening it again.</p>
          <button type="button" onClick={() => void retry()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.statePage} aria-live="polite" aria-busy="true">
      <SidequestLoadingMark label="Opening Sidequest" />
    </main>
  );
}

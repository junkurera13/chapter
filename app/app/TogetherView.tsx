"use client";

import { useCallback, useEffect, useState } from "react";

import SidequestLoadingMark from "../../components/sidequest-loading-mark";
import { loadMyConnections } from "../../lib/base44Connections";
import type { MyConnectionsRecord } from "../../lib/backendTypes";
import styles from "./TogetherView.module.css";

type TogetherState =
  | { status: "loading" }
  | { status: "ready"; connections: MyConnectionsRecord }
  | { status: "error" };

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || "·";
}

export default function TogetherView({ onOpenYou }: { onOpenYou: () => void }) {
  const [state, setState] = useState<TogetherState>({ status: "loading" });

  const loadConnections = useCallback(async () => {
    try {
      const connections = await loadMyConnections();
      setState({ status: "ready", connections });
    } catch (error) {
      console.error("Could not load Sidequest connections", error);
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadMyConnections()
      .then((connections) => {
        if (active) setState({ status: "ready", connections });
      })
      .catch((error) => {
        console.error("Could not load Sidequest connections", error);
        if (active) setState({ status: "error" });
      });

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className={styles.loading} aria-busy="true">
        <SidequestLoadingMark label="Opening Together" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.state}>
        <h1>This connection slipped.</h1>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            void loadConnections();
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  const { accepted, pending } = state.connections;
  if (accepted.length === 0 && pending.length === 0) {
    return (
      <section className={styles.state}>
        <div className={styles.emptyOrbs} aria-hidden="true">
          <span />
          <span />
        </div>
        <h1>Invite someone you know.</h1>
        <p className={styles.stateCopy}>
          Open a person in You and send them a private link. When they accept,
          you’ll appear in each other’s Sidequest.
        </p>
        <button type="button" onClick={onOpenYou}>
          Find a person in You
        </button>
      </section>
    );
  }

  return (
    <section className={styles.together}>
      <header className={styles.header}>
        <h1>People you’re connected with.</h1>
        <p>Shared experiences will live here later.</p>
      </header>

      {accepted.length > 0 ? (
        <div className={styles.people} aria-label="Connected people">
          {accepted.map((connection) => (
            <div className={styles.person} key={connection.id}>
              <span className={styles.personOrb} aria-hidden="true">
                {initialFor(connection.name)}
              </span>
              <span className={styles.personName}>{connection.name}</span>
              <span className={styles.personStatus}>Connected</span>
            </div>
          ))}
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className={styles.pending}>
          <p>Waiting for</p>
          <div>
            {pending.map((invite) => (
              <span key={invite.id}>{invite.name}</span>
            ))}
          </div>
        </div>
      ) : null}

      <button className={styles.addButton} type="button" onClick={onOpenYou}>
        Invite someone else
      </button>
    </section>
  );
}

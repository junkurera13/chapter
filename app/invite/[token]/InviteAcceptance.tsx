"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import ChapterLoadingMark from "@/components/chapter-loading-mark";
import {
  clearBase44Session,
  hasBase44Session,
  isBase44AuthError,
} from "@/lib/base44Auth";
import { rememberBase44AuthReturnPath } from "@/lib/base44AuthReturn";
import { getBase44AuthBridgeUrl } from "@/lib/base44BrowserClient";
import {
  acceptConnectionInvite,
  loadConnectionInvite,
} from "@/lib/base44Connections";
import type { ConnectionInvitePreview } from "@/lib/backendTypes";

import styles from "./invite.module.css";

type InviteState =
  | { status: "loading" }
  | { status: "ready"; preview: ConnectionInvitePreview; signedIn: boolean }
  | { status: "accepting"; preview: ConnectionInvitePreview }
  | { status: "connected"; friendName: string }
  | { status: "error"; message: string };

export default function InviteAcceptance({ token }: { token: string }) {
  const [state, setState] = useState<InviteState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function inspectInvite() {
      try {
        const preview = await loadConnectionInvite(token);
        if (active) {
          setState({
            status: "ready",
            preview,
            signedIn: hasBase44Session(),
          });
        }
      } catch (error) {
        console.error("Could not open the Chapter invitation", error);
        if (active) {
          setState({
            status: "error",
            message: "This invitation could not be opened.",
          });
        }
      }
    }

    void inspectInvite();
    return () => {
      active = false;
    };
  }, [token]);

  function signIn() {
    const returnPath = window.location.pathname;
    rememberBase44AuthReturnPath(returnPath);
    window.location.assign(
      getBase44AuthBridgeUrl(
        new URL(returnPath, window.location.origin).toString(),
      ),
    );
  }

  async function accept(preview: ConnectionInvitePreview) {
    setState({ status: "accepting", preview });
    try {
      const connection = await acceptConnectionInvite(token);
      setState({
        status: "connected",
        friendName: connection.friendName || preview.inviterName || "your friend",
      });
    } catch (error) {
      if (isBase44AuthError(error)) {
        clearBase44Session();
        setState({ status: "ready", preview, signedIn: false });
        return;
      }

      console.error("Could not accept the Chapter invitation", error);
      setState({
        status: "error",
        message: "This invitation may have expired or already been used.",
      });
    }
  }

  if (state.status === "loading") {
    return (
      <main className={styles.page} aria-busy="true">
        <ChapterLoadingMark label="Opening invitation" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>That link has gone quiet.</h1>
          <p className={styles.copy}>{state.message}</p>
          <Link className={styles.secondaryAction} href="/">
            Open Chapter
          </Link>
        </section>
      </main>
    );
  }

  if (state.status === "connected") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.pairedOrbs} aria-hidden="true">
            <span />
            <span />
          </div>
          <h1>You and {state.friendName} are together now.</h1>
          <p className={styles.copy}>
            You each have a person node for the other. Nothing from either
            person’s private memories was shared.
          </p>
          <Link className={styles.primaryAction} href="/app?view=together">
            Open Together
          </Link>
        </section>
      </main>
    );
  }

  const preview = state.preview;
  if (preview.status === "expired" || preview.status === "unavailable") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>This invitation is no longer open.</h1>
          <p className={styles.copy}>Ask your friend to send a fresh link.</p>
        </section>
      </main>
    );
  }

  const inviterName = preview.inviterName || "A friend";
  const invitedName = preview.invitedName || "you";
  const isAccepting = state.status === "accepting";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.pairedOrbs} aria-hidden="true">
          <span />
          <span />
        </div>
        <h1>{inviterName} found {invitedName} in their world.</h1>
        <p className={styles.copy}>
          Connect and you’ll each appear in the other’s world. Your memories stay
          private.
        </p>
        {state.status === "ready" && !state.signedIn ? (
          <button className={styles.primaryAction} type="button" onClick={signIn}>
            Continue with Google
          </button>
        ) : (
          <button
            className={styles.primaryAction}
            type="button"
            disabled={isAccepting}
            onClick={() => void accept(preview)}
          >
            {isAccepting ? "Connecting…" : `Connect with ${inviterName}`}
          </button>
        )}
        <p className={styles.privacy}>The link is single-use and expires.</p>
      </section>
    </main>
  );
}

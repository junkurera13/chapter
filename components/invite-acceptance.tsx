"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ChapterLoadingMark from "./chapter-loading-mark";
import {
  clearBase44Session,
  hasBase44Session,
  isBase44AuthError,
} from "@/lib/base44Auth";
import { rememberBase44AuthReturnPath } from "@/lib/base44AuthReturn";
import {
  acceptConnectionInvite,
  loadConnectionInvite,
} from "@/lib/base44Connections";
import type { ConnectionInvitePreview } from "@/lib/backendTypes";

import styles from "./invite-acceptance.module.css";

type InviteState =
  | { status: "loading" }
  | { status: "ready"; preview: ConnectionInvitePreview; signedIn: boolean }
  | { status: "accepting"; preview: ConnectionInvitePreview }
  | { status: "error"; message: string };

function ChapterMark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <Image src="/chapter-mark.svg" alt="" width={112} height={112} />
    </span>
  );
}

export default function InviteAcceptance({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<InviteState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function inspectInvite() {
      try {
        const preview = await loadConnectionInvite(code);
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
  }, [code]);

  /**
   * Signing up happens on Chapter's own auth card, which offers email as well
   * as Google. The invite path is remembered first, so finishing there lands
   * back on this page with the invitation still open.
   */
  function join() {
    rememberBase44AuthReturnPath(window.location.pathname);
    window.location.assign("/?auth=1");
  }

  async function accept(preview: ConnectionInvitePreview) {
    setState({ status: "accepting", preview });
    try {
      await acceptConnectionInvite(code);
      // Straight into Together. A screen announcing the connection is one more
      // tap between someone and the thing they came here to do. The flag is
      // for anyone arriving without a memory yet, who gets sent to write one
      // and deserves to know why.
      router.replace("/app?view=together&joined=1");
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
          <ChapterMark />
          <h1>That link has gone quiet.</h1>
          <p className={styles.copy}>{state.message}</p>
          <div className={styles.actions}>
            <Link className={styles.exploreAction} href="/">
              Explore Chapter
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const preview = state.preview;
  if (preview.status === "expired" || preview.status === "unavailable") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <ChapterMark />
          <h1>This invitation is no longer open.</h1>
          <p className={styles.copy}>Ask your friend to send a fresh link.</p>
          <div className={styles.actions}>
            <Link className={styles.exploreAction} href="/">
              Explore Chapter
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const inviterName = preview.inviterName || "A friend";
  const isAccepting = state.status === "accepting";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <ChapterMark />
        {/*
          The invitation exists because the reader is already in one of the
          inviter's memories. That is the reason to open an account, so it is
          the headline — addressed to the reader, never naming them.
        */}
        <h1>{inviterName} added a memory with you in it.</h1>
        <div className={styles.actions}>
          {state.status === "ready" && !state.signedIn ? (
            <button className={styles.joinAction} type="button" onClick={join}>
              Join Chapter
            </button>
          ) : (
            <button
              className={styles.joinAction}
              type="button"
              disabled={isAccepting}
              onClick={() => void accept(preview)}
            >
              {isAccepting ? "Connecting…" : `Connect with ${inviterName}`}
            </button>
          )}
          {/*
            A new tab, so looking around Chapter doesn't close the invitation
            they were sent. The dead-link states below have nothing to keep,
            so they navigate in place.
          */}
          <Link
            className={styles.exploreAction}
            href="/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Explore
          </Link>
        </div>
      </section>
    </main>
  );
}

"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { SidequestMark } from "@/components/SidequestMark";
import styles from "./invite.module.css";

function SignedInInvitation({ token }: { token: string }) {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const account = useQuery(api.accounts.current);
  const ensureCurrent = useMutation(api.accounts.ensureCurrent);
  const acceptInvite = useMutation(api.connections.acceptInvite);
  const declineInvite = useMutation(api.connections.declineInvite);
  const started = useRef(false);
  const [working, setWorking] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user || account === undefined || started.current) return;
    started.current = true;
    void ensureCurrent({
      displayName: user.fullName ?? user.firstName ?? undefined,
      imageUrl: user.imageUrl,
    }).catch((cause: unknown) => {
      started.current = false;
      setError(cause instanceof Error ? cause.message : "Could not open invitation");
    });
  }, [account, ensureCurrent, isLoaded, user]);

  if (account === undefined || account === null) {
    return <span className={styles.pulse} aria-label="Opening invitation" />;
  }

  async function accept() {
    setWorking("accept");
    setError(null);
    try {
      await acceptInvite({ token });
      router.replace("/app?tab=together");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not accept invitation");
      setWorking(null);
    }
  }

  async function decline() {
    setWorking("decline");
    setError(null);
    try {
      await declineInvite({ token });
      router.replace("/");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not decline invitation");
      setWorking(null);
    }
  }

  return (
    <div className={styles.actions}>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="button" onClick={accept} disabled={working !== null}>
        {working === "accept" ? "Connecting…" : "Accept invitation"}
      </button>
      <button
        type="button"
        className={styles.decline}
        onClick={decline}
        disabled={working !== null}
      >
        Not now
      </button>
    </div>
  );
}

export default function InviteAcceptance({ token }: { token: string }) {
  const preview = useQuery(api.connections.previewInvite, { token });
  const redirectUrl = `/invite/${encodeURIComponent(token)}`;

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.home} aria-label="Sidequest home">
        <SidequestMark />
      </Link>

      {preview === undefined ? (
        <span className={styles.pulse} aria-label="Opening invitation" />
      ) : preview === null ? (
        <section className={styles.card}>
          <div className={styles.orb} aria-hidden="true" />
          <h1>This invitation cannot be found.</h1>
          <Link href="/">Return to Sidequest</Link>
        </section>
      ) : preview.status !== "pending" ? (
        <section className={styles.card}>
          <div className={styles.orb} aria-hidden="true" />
          <h1>
            {preview.status === "accepted"
              ? "This invitation has already been accepted."
              : "This invitation is no longer open."}
          </h1>
          <Link href="/app">Open Sidequest</Link>
        </section>
      ) : (
        <section className={styles.card}>
          {preview.inviterImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.inviterImageUrl} alt="" className={styles.avatar} />
          ) : (
            <div className={styles.orb} aria-hidden="true" />
          )}
          <p className={styles.eyebrow}>A Sidequest invitation</p>
          <h1>{preview.inviterName} would like to find new memories with you.</h1>

          <AuthLoading>
            <span className={styles.pulse} aria-label="Opening invitation" />
          </AuthLoading>
          <Authenticated>
            <SignedInInvitation token={token} />
          </Authenticated>
          <Unauthenticated>
            <SignInButton mode="modal" forceRedirectUrl={redirectUrl}>
              <button type="button" className={styles.signIn}>
                Continue
              </button>
            </SignInButton>
            <p className={styles.note}>You’ll choose whether to accept after signing in.</p>
          </Unauthenticated>
        </section>
      )}
    </main>
  );
}

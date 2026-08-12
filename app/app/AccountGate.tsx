"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import styles from "./page.module.css";

export default function AccountGate({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const account = useQuery(api.accounts.current);
  const ensureCurrent = useMutation(api.accounts.ensureCurrent);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user || account === undefined || started.current) return;
    started.current = true;

    void ensureCurrent({
      displayName: user.fullName ?? user.firstName ?? undefined,
      imageUrl: user.imageUrl,
    }).catch((cause: unknown) => {
      started.current = false;
      setError(cause instanceof Error ? cause.message : "Could not open Chapter");
    });
  }, [account, ensureCurrent, isLoaded, user]);

  if (error) {
    return (
      <main className={styles.accountState}>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  if (account === undefined || account === null) {
    return (
      <main className={styles.accountState} aria-label="Opening Chapter">
        <span className={styles.accountPulse} aria-hidden="true" />
      </main>
    );
  }

  return children;
}

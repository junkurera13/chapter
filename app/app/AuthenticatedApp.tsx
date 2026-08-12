"use client";

import { RedirectToSignIn } from "@clerk/nextjs";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import AccountGate from "./AccountGate";
import ChapterApp from "./ChapterApp";
import type { ChapterTabIndex } from "./BottomNavigation";
import styles from "./page.module.css";

export default function AuthenticatedApp({
  initialTab,
}: {
  initialTab: ChapterTabIndex;
}) {
  return (
    <>
      <AuthLoading>
        <main className={styles.accountState} aria-label="Opening Chapter">
          <span className={styles.accountPulse} aria-hidden="true" />
        </main>
      </AuthLoading>
      <Authenticated>
        <AccountGate>
          <ChapterApp initialTab={initialTab} />
        </AccountGate>
      </Authenticated>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
    </>
  );
}

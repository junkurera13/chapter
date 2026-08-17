"use client";

import { RedirectToSignIn } from "@clerk/nextjs";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import ChapterLoadingMark from "../../components/chapter-loading-mark";
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
        <main className={styles.accountState}>
          <ChapterLoadingMark label="Opening Chapter" />
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

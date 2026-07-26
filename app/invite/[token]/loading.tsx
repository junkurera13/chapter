import ChapterLoadingMark from "@/components/chapter-loading-mark";

import styles from "./invite.module.css";

export default function ConnectionInviteLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <ChapterLoadingMark label="Opening invitation" />
    </main>
  );
}

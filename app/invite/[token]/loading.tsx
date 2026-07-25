import SidequestLoadingMark from "@/components/sidequest-loading-mark";

import styles from "./invite.module.css";

export default function ConnectionInviteLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <SidequestLoadingMark label="Opening invitation" />
    </main>
  );
}

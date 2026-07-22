import styles from "./invite.module.css";

export default function ConnectionInviteLoading() {
  return (
    <main className={styles.page} aria-label="Opening invitation">
      <div className={styles.loadingOrb} aria-hidden="true" />
    </main>
  );
}

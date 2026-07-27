"use client";

import styles from "./TogetherView.module.css";

/**
 * The standing decision about strangers.
 *
 * Deliberately a decision rather than a setting. It says what Chapter would
 * actually do before it does any of it, names the limit on what can be shown,
 * and can be taken back in one press, at which point every offer already
 * standing in someone else's app is withdrawn.
 */
export default function TogetherOpenToCard({
  optedIn,
  homeCity,
  busy,
  notice,
  onChange,
}: {
  optedIn: boolean;
  homeCity: string;
  busy: boolean;
  notice: string;
  onChange: (optIn: boolean) => void;
}) {
  return (
    <section className={styles.openTo}>
      <p className={styles.openToHeader}>
        <span className={styles.strangerOrb} aria-hidden="true" />
        People you haven’t met
      </p>

      <p className={styles.openToCopy}>
        {optedIn
          ? homeCity
            ? `Chapter can tell you when someone in ${homeCity} turns out to share something with you. It shows you the thing you share, never their name, and nothing about you until you both say yes.`
            : "Set a home city in Now, and Chapter can tell you when someone near you turns out to share something with you."
          : "Chapter can look for someone near you whose world already overlaps with yours. It would only ever show you the part you already have."}
      </p>

      <div className={styles.openToActions}>
        <div className={styles.actions}>
          <button
            type="button"
            className={optedIn ? styles.quiet : undefined}
            disabled={busy}
            onClick={() => onChange(!optedIn)}
          >
            {optedIn ? "Stop looking" : "Look for someone"}
          </button>
        </div>
      </div>

      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </section>
  );
}

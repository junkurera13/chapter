"use client";

import AnchoredCopy from "../../components/anchored-copy";
import type { IntroductionRecord } from "../../lib/introductionSchema";
import styles from "./TogetherView.module.css";

/**
 * Someone you have not met, and the one thing your two worlds already share.
 *
 * The card is deliberately poorer than a gist card. There is no name to lead
 * with and no face to put on it, so the sentence is the whole object, and the
 * orb that stands for the other person is drawn hollow: a real person, not yet
 * anyone you know.
 *
 * Once answered it stops asking. It never reports what the other person did,
 * because that is a fact about them, and because an introduction you said yes
 * to should not become a thing you sit and watch.
 */
export default function TogetherIntroductionCard({
  introduction,
  busy,
  notice,
  onAnswer,
}: {
  introduction: IntroductionRecord;
  busy: boolean;
  notice: string;
  onAnswer: (answer: "yes" | "no") => void;
}) {
  const waiting = introduction.state === "waiting";

  return (
    <article className={styles.card}>
      <p className={styles.cardStatus}>
        <span className={styles.strangerOrb} aria-hidden="true" />
        {waiting ? "You said yes" : "Someone you haven’t met"}
      </p>

      <div className={styles.cardBody}>
        <p className={waiting ? styles.gistLineQuiet : styles.gistLine}>
          <AnchoredCopy
            text={introduction.line}
            anchors={introduction.anchors}
          />
        </p>
      </div>

      <div className={styles.cardFoot}>
        {waiting ? (
          <p className={styles.strangerWaiting}>
            If they say yes too, you’ll both know.
          </p>
        ) : (
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAnswer("yes")}
            >
              I’d go
            </button>
            <button
              type="button"
              className={styles.quiet}
              disabled={busy}
              onClick={() => onAnswer("no")}
            >
              Not this one
            </button>
          </div>
        )}

        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </div>
    </article>
  );
}

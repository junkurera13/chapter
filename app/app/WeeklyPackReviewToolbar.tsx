"use client";

import {
  WEEKLY_PACK_REVIEW_STATES,
  type WeeklyPackReviewState,
} from "@/lib/weeklyPackPreview";

import styles from "./WeeklyPackReviewToolbar.module.css";

export default function WeeklyPackReviewToolbar({
  state,
  onChange,
  onExit,
}: {
  state: WeeklyPackReviewState;
  onChange: (state: WeeklyPackReviewState) => void;
  onExit: () => void;
}) {
  const index = WEEKLY_PACK_REVIEW_STATES.findIndex(
    (candidate) => candidate.id === state,
  );
  const previous =
    WEEKLY_PACK_REVIEW_STATES[
      (index - 1 + WEEKLY_PACK_REVIEW_STATES.length) %
        WEEKLY_PACK_REVIEW_STATES.length
    ];
  const next =
    WEEKLY_PACK_REVIEW_STATES[
      (index + 1) % WEEKLY_PACK_REVIEW_STATES.length
    ];

  return (
    <aside className={styles.toolbar} aria-label="Now UI review">
      <button
        type="button"
        className={styles.step}
        aria-label={`Previous state: ${previous.label}`}
        onClick={() => onChange(previous.id)}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m12.5 4.5-5 5.5 5 5.5" />
        </svg>
      </button>

      <label className={styles.state}>
        <span>Now UI · {index + 1} of {WEEKLY_PACK_REVIEW_STATES.length}</span>
        <select
          value={state}
          aria-label="Review state"
          onChange={(event) =>
            onChange(event.target.value as WeeklyPackReviewState)
          }
        >
          {WEEKLY_PACK_REVIEW_STATES.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={styles.step}
        aria-label={`Next state: ${next.label}`}
        onClick={() => onChange(next.id)}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m7.5 4.5 5 5.5-5 5.5" />
        </svg>
      </button>

      <span className={styles.divider} aria-hidden="true" />

      <button
        type="button"
        className={styles.exit}
        onClick={onExit}
        aria-label="Exit Now UI review"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m5.5 5.5 9 9m0-9-9 9" />
        </svg>
      </button>
    </aside>
  );
}

"use client";

import { useEffect, useRef } from "react";

import styles from "./welcome-dialog.module.css";

/**
 * The one thing someone needs to hear after accepting an invitation: it
 * worked, and here is why they are being asked for a memory rather than shown
 * the thing they came for.
 *
 * A native <dialog> so the page behind it is properly inert — focus stays
 * here, Escape closes, and the backdrop is the browser's own.
 */
export default function WelcomeDialog({
  message,
  actionLabel = "Continue",
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onDismiss}
      onCancel={onDismiss}
    >
      <div className={styles.panel}>
        <p className={styles.message}>{message}</p>
        <button
          type="button"
          className={styles.action}
          onClick={() => dialogRef.current?.close()}
        >
          {actionLabel}
        </button>
      </div>
    </dialog>
  );
}


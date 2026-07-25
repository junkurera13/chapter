"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";

import EmailAuthForm from "./EmailAuthForm";
import { GoogleLoginButton } from "./GoogleLoginButton";
import styles from "./AuthModal.module.css";

export default function AuthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const bodyOverflow = document.body.style.overflow;
    const landing = document.querySelector<HTMLElement>("[data-landing-page]");
    const landingOverflow = landing?.style.overflow ?? "";
    document.body.style.overflow = "hidden";
    if (landing) landing.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      closeRef.current?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = bodyOverflow;
      if (landing) landing.style.overflow = landingOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.root} role="presentation">
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close log in"
        onClick={onClose}
      />

      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.closeIcon}>
            <path
              d="M6.4 6.4a1 1 0 0 1 1.4 0L12 10.6l4.2-4.2a1 1 0 1 1 1.4 1.4L13.4 12l4.2 4.2a1 1 0 0 1-1.4 1.4L12 13.4l-4.2 4.2a1 1 0 0 1-1.4-1.4L10.6 12 6.4 7.8a1 1 0 0 1 0-1.4Z"
              fill="currentColor"
            />
          </svg>
        </button>

        <div className={styles.header}>
          <Image
            className={styles.mark}
            src="/sidequest-mark.svg"
            alt=""
            width={88}
            height={88}
            priority
          />
          <h2 id={titleId} className={styles.title}>
            Log in or sign up
          </h2>
        </div>

        <div className={styles.body}>
          <GoogleLoginButton />
          <div className={styles.divider} aria-hidden="true">
            or
          </div>
          <EmailAuthForm />
        </div>
      </div>
    </div>
  );
}

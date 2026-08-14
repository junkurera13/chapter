"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from "react";

import { api } from "@/convex/_generated/api";

import styles from "./LandingActions.module.css";

type LandingSurface = "access" | "waitlist";

type LandingActionsContextValue = {
  openSurface: (surface: LandingSurface, trigger: HTMLButtonElement) => void;
};

const LandingActionsContext = createContext<LandingActionsContextValue | null>(
  null,
);

function useLandingActions() {
  const context = useContext(LandingActionsContext);
  if (!context) {
    throw new Error("Landing actions must be rendered inside their provider.");
  }
  return context;
}

export function LandingActionsProvider({ children }: { children: ReactNode }) {
  const [surface, setSurface] = useState<LandingSurface | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openSurface = useCallback(
    (nextSurface: LandingSurface, trigger: HTMLButtonElement) => {
      triggerRef.current = trigger;
      setSurface(nextSurface);
    },
    [],
  );

  const closeSurface = useCallback(() => {
    setSurface(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("access") === "1") {
      const timer = window.setTimeout(() => setSurface("access"), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!surface) return;

    const landingPage = document.querySelector<HTMLElement>(
      "main[data-landing-page]",
    );
    const previousOverflow = landingPage?.style.overflowY ?? "";
    const previousInert = landingPage?.inert ?? false;
    if (landingPage) {
      landingPage.style.overflowY = "hidden";
      landingPage.inert = true;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSurface();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (landingPage) {
        landingPage.style.overflowY = previousOverflow;
        landingPage.inert = previousInert;
      }
    };
  }, [closeSurface, surface]);

  return (
    <LandingActionsContext value={{ openSurface }}>
      {children}
      {surface === "waitlist" ? (
        <WaitlistSurface onClose={closeSurface} />
      ) : null}
      {surface === "access" ? (
        <AccessSurface onClose={closeSurface} />
      ) : null}
    </LandingActionsContext>
  );
}

type OpenButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function WaitlistOpenButton({
  onClick,
  type = "button",
  ...props
}: OpenButtonProps) {
  const { openSurface } = useLandingActions();

  return (
    <button
      {...props}
      type={type}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openSurface("waitlist", event.currentTarget);
      }}
    />
  );
}

export function AccessOpenButton({
  onClick,
  type = "button",
  ...props
}: OpenButtonProps) {
  const { openSurface } = useLandingActions();

  return (
    <button
      {...props}
      type={type}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openSurface("access", event.currentTarget);
      }}
    />
  );
}

function SurfaceFrame({
  children,
  label,
  labelledBy,
  onClose,
  showIdentity = true,
}: {
  children: ReactNode;
  label: string;
  labelledBy: string;
  onClose: () => void;
  showIdentity?: boolean;
}) {
  return (
    <div
      className={styles.surface}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className={`${styles.surfaceHeader} ${
          showIdentity ? "" : styles.surfaceHeaderEnd
        }`}
      >
        {showIdentity ? (
          <div className={styles.surfaceIdentity}>
            <span className={styles.surfaceMark} aria-hidden="true">
              <Image src="/chapter-mark.svg" alt="" width={30} height={30} />
            </span>
            <span className={styles.surfaceLabel}>{label}</span>
          </div>
        ) : null}
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label={`Close ${label.toLowerCase()}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}

function WaitlistSurface({ onClose }: { onClose: () => void }) {
  const joinWaitlist = useMutation(api.waitlist.join);
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await joinWaitlist({ email });
      setIsJoined(true);
    } catch {
      setError("Check your email and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SurfaceFrame
      label="Waitlist"
      labelledBy="waitlist-title"
      onClose={onClose}
      showIdentity={false}
    >
      <div className={styles.surfaceContent}>
        {isJoined ? (
          <>
            <h2 id="waitlist-title" className={styles.surfaceTitle}>
              You’re on the list.
            </h2>
            <p className={styles.surfaceCopy}>We’ll be in touch.</p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onClose}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <h2 id="waitlist-title" className={styles.surfaceTitle}>
              Join the Chapter waitlist.
            </h2>
            <p className={styles.surfaceCopy}>
              We’ll let you know when a place opens.
            </p>
            <form className={styles.form} onSubmit={submit}>
              <input
                ref={inputRef}
                className={styles.input}
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                placeholder="Email address"
                aria-label="Email address"
                required
              />
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Joining…" : "Join waitlist"}
              </button>
              <p className={styles.formMessage} role="status" aria-live="polite">
                {error}
              </p>
            </form>
          </>
        )}
      </div>
    </SurfaceFrame>
  );
}

function AccessSurface({ onClose }: { onClose: () => void }) {
  const { isSignedIn } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("That password doesn’t match.");
        return;
      }

      window.location.assign(isSignedIn ? "/app" : "/sign-in");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SurfaceFrame label="Access" labelledBy="access-title" onClose={onClose}>
      <div className={styles.surfaceContent}>
        <h2 id="access-title" className={styles.surfaceTitle}>
          Chapter is private for now.
        </h2>
        <p className={styles.surfaceCopy}>
          Enter the access password to continue.
        </p>
        <form className={styles.form} onSubmit={submit}>
          <input
            ref={inputRef}
            className={styles.input}
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={128}
            placeholder="Password"
            aria-label="Access password"
            required
          />
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Checking…" : "Continue"}
          </button>
          <p className={styles.formMessage} role="status" aria-live="polite">
            {error}
          </p>
        </form>
      </div>
    </SurfaceFrame>
  );
}

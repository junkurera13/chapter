"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  forgetBase44AuthReturnPath,
  readBase44AuthReturnPath,
} from "@/lib/base44AuthReturn";
import { getBase44BrowserClient } from "@/lib/base44BrowserClient";
import {
  authErrorMessage as messageOf,
  authErrorStatus as statusOf,
  isBadCredentialsError,
  isExistingAccountError,
  isUnverifiedAccountError,
} from "@/lib/emailAuthErrors";
import styles from "./EmailAuthForm.module.css";

type Phase =
  | { kind: "credentials" }
  | { kind: "otp"; email: string; password: string }
  | { kind: "done" };

type FieldError = string | null;

export default function EmailAuthForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FieldError>(null);
  const [otpError, setOtpError] = useState<FieldError>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase.kind === "credentials") emailRef.current?.focus();
    else if (phase.kind === "otp") otpRef.current?.focus();
  }, [phase]);

  function goHome() {
    // An invitation opened before signing up is waiting to be accepted, so it
    // wins over the app's front door.
    const invite = readBase44AuthReturnPath();
    if (invite) {
      forgetBase44AuthReturnPath();
      router.replace(invite);
      return;
    }
    router.replace("/app");
  }

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setOtpError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email to continue.");
      return;
    }
    if (!password) {
      setError("Enter a password.");
      return;
    }

    setBusy(true);
    const client = getBase44BrowserClient();
    try {
      try {
        await client.auth.register({ email: trimmedEmail, password });
        setPhase({ kind: "otp", email: trimmedEmail, password });
        return;
      } catch (cause) {
        // One field for both doors: an account that is already there is a
        // sign-in, not a failure. Anything else really did go wrong.
        if (!isExistingAccountError(cause)) throw cause;
      }

      try {
        await client.auth.loginViaEmailPassword(trimmedEmail, password);
        setPhase({ kind: "done" });
        goHome();
      } catch (cause) {
        const status = statusOf(cause);
        if (isUnverifiedAccountError(cause)) {
          setPhase({ kind: "otp", email: trimmedEmail, password });
        } else if (isBadCredentialsError(cause)) {
          setError("That email and password don’t match.");
        } else if (status !== undefined && status < 500) {
          setError(messageOf(cause));
        } else {
          setError("Couldn’t reach Chapter. Try again.");
        }
      }
    } catch (cause) {
      // A registration Base44 turned down for its own reason, such as a
      // password it won't accept. Its wording is the useful part.
      const status = statusOf(cause);
      if (status !== undefined && status < 500) {
        setError(messageOf(cause));
      } else {
        setError("Couldn’t reach Chapter. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(event: React.FormEvent) {
    event.preventDefault();
    if (busy || phase.kind !== "otp") return;
    setOtpError(null);

    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setOtpError("Enter the code we sent you.");
      return;
    }

    setBusy(true);
    const client = getBase44BrowserClient();
    try {
      try {
        await client.auth.verifyOtp({
          email: phase.email,
          otpCode: trimmedOtp,
        });
      } catch (cause) {
        const status = statusOf(cause);
        if (status === 429) {
          setOtpError("Too many attempts. Wait a moment, then try again.");
        } else if (status === undefined || status >= 500) {
          setOtpError("Couldn’t verify. Try again.");
        } else {
          setOtpError("That code isn’t right or has expired.");
        }
        return;
      }

      // The code was spent the moment it was accepted, so a failure from here
      // on is the sign-in behind it. Saying "that code is wrong" would send
      // someone back to a screen that can no longer help them.
      try {
        await client.auth.loginViaEmailPassword(phase.email, phase.password);
      } catch (cause) {
        setOtpError(
          isBadCredentialsError(cause)
            ? "Verified. That password didn’t work, though. Go back and try again."
            : "Verified, but signing in failed. Try again.",
        );
        return;
      }

      setPhase({ kind: "done" });
      goHome();
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (busy || phase.kind !== "otp") return;
    setOtpError(null);
    setBusy(true);
    try {
      await getBase44BrowserClient().auth.resendOtp(phase.email);
      setOtpError("Sent a fresh code.");
    } catch (cause) {
      if (statusOf(cause) === 429) {
        setOtpError("Too many requests. Wait a moment, then try again.");
      } else {
        setOtpError("Couldn’t resend. Try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  }

  function goBackToCredentials() {
    setPhase({ kind: "credentials" });
    setOtp("");
    setOtpError(null);
    setError(null);
  }

  if (phase.kind === "otp") {
    return (
      <form className={styles.form} onSubmit={submitOtp}>
        <p className={styles.hint}>
          We sent a code to <span className={styles.email}>{phase.email}</span>.
        </p>
        <label className={styles.field}>
          <input
            ref={otpRef}
            className={styles.input}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder=" "
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            disabled={busy}
          />
          <span className={styles.label}>Verification code</span>
        </label>
        {otpError ? <p className={styles.error} role="alert">{otpError}</p> : null}
        <button
          className={styles.primary}
          type="submit"
          disabled={busy || otp.trim() === ""}
        >
          {busy ? "Verifying…" : "Verify and continue"}
        </button>
        <div className={styles.aux}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={resendCode}
            disabled={busy}
          >
            Resend code
          </button>
          <span className={styles.dot} aria-hidden="true">·</span>
          <button
            type="button"
            className={styles.linkButton}
            onClick={goBackToCredentials}
            disabled={busy}
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={submitCredentials}>
      <label className={styles.field}>
        <input
          ref={emailRef}
          className={styles.input}
          type="email"
          autoComplete="email"
          placeholder=" "
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
        <span className={styles.label}>Email</span>
      </label>
      <label className={styles.field}>
        <input
          className={styles.input}
          type="password"
          autoComplete="current-password"
          placeholder=" "
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
        />
        <span className={styles.label}>Password</span>
      </label>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <button
        className={styles.primary}
        type="submit"
        disabled={busy || email.trim() === "" || password === ""}
      >
        {busy ? "Continuing…" : "Continue"}
      </button>
    </form>
  );
}

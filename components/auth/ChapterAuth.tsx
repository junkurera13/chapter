"use client";

import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import overlay from "@/app/LandingActions.module.css";

import { AuthSurface, GoogleMark } from "./AuthSurface";
import styles from "./chapter-auth.module.css";
import { clerkErrorMessage } from "./clerk-errors";
import { chapterAuthNavigate } from "./finish-auth";

function isMissingAccount(code: string | undefined) {
  return code === "form_identifier_not_found" || code === "identifier_not_found";
}

export default function ChapterAuth({
  redirectUrl,
  onClose,
}: {
  redirectUrl: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const {
    signIn,
    errors: signInErrors,
    fetchStatus: signInStatus,
  } = useSignIn();
  const {
    signUp,
    errors: signUpErrors,
    fetchStatus: signUpStatus,
  } = useSignUp();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isSignedIn) router.replace(redirectUrl);
  }, [isSignedIn, redirectUrl, router]);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const busy = signInStatus === "fetching" || signUpStatus === "fetching";
  const navigate = chapterAuthNavigate(redirectUrl, router.replace);

  async function finishSignIn() {
    if (signIn.status !== "complete") return false;
    const { error: finalizeError } = await signIn.finalize({ navigate });
    if (finalizeError) {
      setError(finalizeError.longMessage || finalizeError.message);
      return false;
    }
    return true;
  }

  async function finishSignUp() {
    if (signUp.status === "complete") {
      const { error: finalizeError } = await signUp.finalize({ navigate });
      if (finalizeError) {
        setError(finalizeError.longMessage || finalizeError.message);
        return false;
      }
      return true;
    }

    if (signUp.unverifiedFields.includes("email_address")) {
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(sendError.longMessage || sendError.message);
        return false;
      }
      setNeedsCode(true);
      return true;
    }

    return false;
  }

  async function continueWithGoogle() {
    setError("");
    const { error: oauthError } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl,
      redirectCallbackUrl: "/sso-callback",
    });
    if (oauthError) setError(oauthError.longMessage || oauthError.message);
  }

  async function createAccount() {
    const { error: signUpError } = await signUp.password({
      emailAddress: email,
      password,
    });
    if (signUpError) {
      setError(
        signUpError.longMessage ||
          signUpError.message ||
          clerkErrorMessage(signUpErrors),
      );
      return;
    }
    if (await finishSignUp()) return;
    setError(clerkErrorMessage(signUpErrors) || "Couldn’t finish signing up.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (needsCode) {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({
        code,
      });
      if (verifyError) {
        setError(
          verifyError.longMessage ||
            verifyError.message ||
            clerkErrorMessage(signUpErrors),
        );
        return;
      }
      if (await finishSignUp()) return;
      setError(clerkErrorMessage(signUpErrors) || "Couldn’t verify that code.");
      return;
    }

    const { error: passwordError } = await signIn.create({
      identifier: email,
      password,
      signUpIfMissing: true,
    });

    if (await finishSignIn()) return;

    if (signIn.isTransferable) {
      const { error: transferError } = await signUp.create({ transfer: true });
      if (transferError) {
        await createAccount();
        return;
      }
      if (await finishSignUp()) return;
    }

    if (passwordError && isMissingAccount(passwordError.code)) {
      await createAccount();
      return;
    }

    if (passwordError) {
      setError(
        passwordError.longMessage ||
          passwordError.message ||
          clerkErrorMessage(signInErrors),
      );
      return;
    }

    setError(clerkErrorMessage(signInErrors) || "Couldn’t finish signing in.");
  }

  return (
    <AuthSurface labelledBy="auth-title" onClose={onClose}>
      <h2 id="auth-title" className={styles.title}>
        {needsCode ? "Check your email." : "Log in or sign up"}
      </h2>
      <form className={`${overlay.form} ${styles.form}`} onSubmit={submit}>
        {needsCode ? (
          <input
            className={overlay.input}
            type="text"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Verification code"
            aria-label="Verification code"
            required
          />
        ) : (
          <>
            <button
              type="button"
              className={styles.googleButton}
              onClick={continueWithGoogle}
              disabled={busy}
            >
              <GoogleMark />
              Continue with Google
            </button>
            <p className={styles.divider}>or</p>
            <input
              ref={emailRef}
              className={overlay.input}
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="Email address"
              aria-label="Email address"
              required
            />
            <input
              className={overlay.input}
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              required
            />
          </>
        )}
        <button className={overlay.primaryButton} type="submit" disabled={busy}>
          {busy ? "Continuing…" : needsCode ? "Verify" : "Continue"}
        </button>
        <p className={overlay.formMessage} role="status" aria-live="polite">
          {error}
        </p>
      </form>
    </AuthSurface>
  );
}

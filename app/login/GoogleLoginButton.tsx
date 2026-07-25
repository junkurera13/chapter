"use client";

import { useState } from "react";

import { startBase44GoogleLogin } from "@/lib/base44BrowserClient";
import styles from "./GoogleLoginButton.module.css";

export function GoogleLoginButton() {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (leaving) return;
    setError(null);
    setLeaving(true);

    const result = await startBase44GoogleLogin({
      onStatus: () => {
        // keep button in busy state while popup is open
      },
    });

    if (result.ok) {
      // Full-page local redirect already navigated, or production popup
      // handler navigates to /app after saving the token.
      return;
    }

    setLeaving(false);
    if (result.reason === "popup_blocked") {
      setError("Allow popups for this site, then try Google again.");
      return;
    }
    setError("Google sign-in was closed before it finished. Try again.");
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.google}
        onClick={() => void signIn()}
        disabled={leaving}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path
            fill="#4285F4"
            d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 5-.9 6.8-2.3l-3.3-2.6c-.9.6-2.1 1-3.5 1a6 6 0 0 1-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.4 14a6 6 0 0 1 0-3.9V7.4H3a10 10 0 0 0 0 9.3L6.4 14Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.9c1.6 0 3 .5 4.2 1.6l3.1-3.1A10 10 0 0 0 3 7.4l3.4 2.7A6 6 0 0 1 12 6Z"
          />
        </svg>
        <span>{leaving ? "Waiting for Google…" : "Continue with Google"}</span>
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

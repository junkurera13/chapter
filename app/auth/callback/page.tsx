"use client";

import { useEffect, useState } from "react";
import { saveAccessToken } from "@base44/sdk";

/**
 * OAuth return target for production Google popup sign-in.
 *
 * Base44 may either:
 * 1) postMessage the token to the opener from its "Login complete" page, or
 * 2) navigate this popup to /auth/callback?access_token=...
 *
 * In case (2) we persist the token, notify the opener, and close.
 * If there is no opener (full-page fallback), we continue into /app.
 */
export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("access_token");

    if (!token) {
      setMessage("Sign-in didn’t return a session. Try again.");
      window.setTimeout(() => {
        window.location.replace("/?auth=1");
      }, 1200);
      return;
    }

    saveAccessToken(token, {});
    try {
      window.localStorage.setItem("token", token);
    } catch {
      // ignore
    }

    const payload = {
      access_token: token,
      source: "sidequest-auth-callback",
      is_new_user: params.get("is_new_user"),
    };

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(payload, window.location.origin);
      } catch {
        // Fall through to full navigation in the opener path below.
      }
      setMessage("Signed in — you can close this window.");
      window.setTimeout(() => {
        try {
          window.close();
        } catch {
          window.location.replace("/app");
        }
      }, 150);
      return;
    }

    window.location.replace("/app");
  }, []);

  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        margin: 0,
        background: "#fff",
        color: "#1c1c19",
        fontFamily: "system-ui, sans-serif",
        fontSize: 15,
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
    </main>
  );
}

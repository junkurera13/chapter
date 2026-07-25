import { createClient, type Base44Client } from "@base44/sdk";

import { BASE44_APP_ID } from "./base44Client";

const BASE44_ORIGIN = "https://base44.app";
const BASE44_LOGIN_ORIGIN = "https://app.base44.com";
const BASE44_APP_ORIGIN = "https://sidequest-b44.base44.app";

let browserClient: Base44Client | null = null;

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function isLocalAuthHost() {
  if (typeof window === "undefined") return false;
  return isLocalHostname(window.location.hostname);
}

/**
 * Direct Google OAuth URL (full-page). Safe for localhost only — production
 * external hosts hit Base44's "Domain is not valid" check on full-page return.
 */
export function getBase44GoogleLoginUrl(returnUrl: string) {
  const requestedReturnUrl = new URL(returnUrl);
  const params = new URLSearchParams({
    app_id: BASE44_APP_ID,
    from_url: requestedReturnUrl.toString(),
  });
  return `${BASE44_ORIGIN}/api/apps/auth/login?${params.toString()}`;
}

/**
 * Production Google login must use a real popup.
 *
 * Setting `popup_origin` makes Base44 finish OAuth on a "Login complete" page
 * that postMessages the token to `window.opener`. Full-page navigation with
 * `popup_origin` leaves you stuck on that white page (no opener).
 *
 * `popup_origin` must be this app's origin so the message can reach the parent.
 */
export function getBase44PopupGoogleLoginUrl(options: {
  callbackUrl: string;
  popupOrigin: string;
}) {
  const params = new URLSearchParams({
    app_id: BASE44_APP_ID,
    from_url: options.callbackUrl,
    popup_origin: options.popupOrigin,
  });
  return `${BASE44_LOGIN_ORIGIN}/api/apps/auth/login?${params.toString()}`;
}

export type GoogleLoginResult =
  | { ok: true }
  | { ok: false; reason: "popup_blocked" | "closed" };

/**
 * Start Google sign-in. Production uses a popup + postMessage; localhost uses
 * a full-page redirect (allowed by Base44).
 */
export function startBase44GoogleLogin(options?: {
  onStatus?: (status: "opening" | "waiting") => void;
}): Promise<GoogleLoginResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, reason: "closed" });
  }

  const origin = window.location.origin;
  const appUrl = new URL("/app", origin).toString();
  const callbackUrl = new URL("/auth/callback", origin).toString();

  if (isLocalHostname(window.location.hostname)) {
    options?.onStatus?.("opening");
    window.location.assign(getBase44GoogleLoginUrl(appUrl));
    return Promise.resolve({ ok: true });
  }

  options?.onStatus?.("opening");
  const loginUrl = getBase44PopupGoogleLoginUrl({
    callbackUrl,
    popupOrigin: origin,
  });

  const width = 480;
  const height = 640;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open(
    loginUrl,
    "sidequest_base44_google_auth",
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );

  if (!popup) {
    return Promise.resolve({ ok: false, reason: "popup_blocked" });
  }

  options?.onStatus?.("waiting");

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: GoogleLoginResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(pollTimer);
      try {
        if (!popup.closed) popup.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const acceptToken = (token: string) => {
      if (!token) return;
      try {
        window.localStorage.setItem("base44_access_token", token);
        window.localStorage.setItem("token", token);
      } catch {
        // ignore storage failures; URL handoff in callback may still work
      }
      finish({ ok: true });
      window.location.assign(appUrl);
    };

    const onMessage = (event: MessageEvent) => {
      const allowedOrigins = new Set([
        origin,
        BASE44_LOGIN_ORIGIN,
        BASE44_ORIGIN,
        BASE44_APP_ORIGIN,
      ]);
      if (!allowedOrigins.has(event.origin)) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;
      const token =
        "access_token" in data && typeof data.access_token === "string"
          ? data.access_token
          : null;
      if (!token) return;

      acceptToken(token);
    };

    // If Base44 redirects the popup onto our /auth/callback with the token,
    // the callback page postMessages us. Also detect same-origin token URLs.
    const pollTimer = window.setInterval(() => {
      if (popup.closed) {
        // Parent may already have the token from postMessage.
        if (!settled && window.localStorage.getItem("base44_access_token")) {
          finish({ ok: true });
          window.location.assign(appUrl);
          return;
        }
        finish({ ok: false, reason: "closed" });
        return;
      }

      try {
        const popupUrl = popup.location.href;
        if (!popupUrl || popupUrl === "about:blank") return;
        const parsed = new URL(popupUrl);
        if (parsed.origin !== origin) return;
        const token = parsed.searchParams.get("access_token");
        if (token) acceptToken(token);
      } catch {
        // Cross-origin until Base44 returns to our host — expected.
      }
    }, 400);

    window.addEventListener("message", onMessage);
  });
}

export function getBase44BrowserClient() {
  if (typeof window === "undefined") {
    throw new Error("The Base44 browser client is only available in the browser.");
  }

  if (!browserClient) {
    browserClient = createClient({
      appId: BASE44_APP_ID,
      appBaseUrl: BASE44_ORIGIN,
    });
  }

  return browserClient;
}

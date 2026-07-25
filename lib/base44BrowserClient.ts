import { createClient, type Base44Client } from "@base44/sdk";

import { BASE44_APP_ID } from "./base44Client";

const BASE44_ORIGIN = "https://base44.app";
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

export function getBase44AuthBridgeUrl(returnUrl: string) {
  const bridgeUrl = new URL("/oauth-start", BASE44_APP_ORIGIN);
  bridgeUrl.searchParams.set("return_url", new URL(returnUrl).toString());
  return bridgeUrl.toString();
}

export type GoogleLoginResult =
  | { ok: true }
  | { ok: false; reason: "navigation_failed" };

/**
 * Start Google sign-in. Production first visits the Base44-hosted bridge so
 * Base44 records its own app domain as the OAuth referrer.
 */
export function startBase44GoogleLogin(options?: {
  returnUrl?: string;
  onStatus?: (status: "opening" | "waiting") => void;
}): Promise<GoogleLoginResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, reason: "navigation_failed" });
  }

  const origin = window.location.origin;
  const returnUrl = new URL(options?.returnUrl || "/app", origin).toString();

  try {
    options?.onStatus?.("opening");
    window.location.assign(
      isLocalHostname(window.location.hostname)
        ? getBase44GoogleLoginUrl(returnUrl)
        : getBase44AuthBridgeUrl(returnUrl),
    );
    return Promise.resolve({ ok: true });
  } catch {
    return Promise.resolve({ ok: false, reason: "navigation_failed" });
  }
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

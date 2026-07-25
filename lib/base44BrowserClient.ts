import { createClient, type Base44Client } from "@base44/sdk";

import { BASE44_APP_ID } from "./base44Client";

const BASE44_ORIGIN = "https://base44.app";
const BASE44_APP_ORIGIN = "https://sidequest-b44.base44.app";
/** Base44-hosted hop that starts Google OAuth with a valid app domain. */
const BASE44_AUTH_START_URL = `${BASE44_APP_ORIGIN}/oauth-start`;

let browserClient: Base44Client | null = null;

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Build the Google OAuth entry URL for Sidequest.
 *
 * Localhost may return straight to the dev server. Production must hop through
 * the Base44-hosted app domain: Base44's OAuth callback validates `domain` in
 * the OAuth state against `from_url`, and rejects external hosts (including
 * Vercel) with "Domain is not valid". Passing `popup_origin` set to the app
 * domain forces `domain` onto that host so the bridge return is accepted.
 */
export function getBase44GoogleLoginUrl(returnUrl: string) {
  const requestedReturnUrl = new URL(returnUrl);

  if (isLocalHostname(requestedReturnUrl.hostname)) {
    const params = new URLSearchParams({
      app_id: BASE44_APP_ID,
      from_url: requestedReturnUrl.toString(),
    });
    return `${BASE44_ORIGIN}/api/apps/auth/login?${params.toString()}`;
  }

  // Production: land on the Base44-hosted starter so OAuth state.domain is the
  // app subdomain (not app.base44.com / vercel.app).
  return BASE44_AUTH_START_URL;
}

/** Absolute login URL used by the Base44-hosted oauth-start page. */
export function getBase44ProductionGoogleLoginUrl() {
  const bridgeReturn = `${BASE44_APP_ORIGIN}/oauth-return`;
  const params = new URLSearchParams({
    app_id: BASE44_APP_ID,
    from_url: bridgeReturn,
    // Base44 copies this into OAuth state as `domain`. Matching the bridge host
    // is what makes the post-Google redirect succeed for external Next apps.
    popup_origin: BASE44_APP_ORIGIN,
  });
  return `${BASE44_ORIGIN}/api/apps/auth/login?${params.toString()}`;
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

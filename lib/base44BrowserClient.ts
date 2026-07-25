import { createClient, type Base44Client } from "@base44/sdk";

import { BASE44_APP_ID } from "./base44Client";

const BASE44_ORIGIN = "https://base44.app";
const BASE44_AUTH_BRIDGE_URL =
  "https://sidequest-b44.base44.app/oauth-return";

let browserClient: Base44Client | null = null;

export function getBase44GoogleLoginUrl(returnUrl: string) {
  const requestedReturnUrl = new URL(returnUrl);
  const isLocalDevelopment =
    requestedReturnUrl.hostname === "localhost" ||
    requestedReturnUrl.hostname === "127.0.0.1";
  const params = new URLSearchParams({
    app_id: BASE44_APP_ID,
    from_url: isLocalDevelopment
      ? requestedReturnUrl.toString()
      : BASE44_AUTH_BRIDGE_URL,
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

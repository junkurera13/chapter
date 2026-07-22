import { createClient, type Base44Client } from "@base44/sdk";

import { BASE44_APP_ID } from "./base44Client";

const BASE44_ORIGIN = "https://base44.app";

let browserClient: Base44Client | null = null;

export function getBase44GoogleLoginUrl(returnUrl: string) {
  const params = new URLSearchParams({
    app_id: BASE44_APP_ID,
    from_url: returnUrl,
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

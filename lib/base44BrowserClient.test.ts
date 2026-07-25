import { describe, expect, it } from "vitest";

import {
  getBase44GoogleLoginUrl,
  getBase44PopupGoogleLoginUrl,
} from "./base44BrowserClient";

describe("getBase44GoogleLoginUrl", () => {
  it("builds a full-page login URL with the requested return", () => {
    const returnUrl = "http://localhost:3000/app";
    const loginUrl = new URL(getBase44GoogleLoginUrl(returnUrl));

    expect(loginUrl.origin + loginUrl.pathname).toBe(
      "https://base44.app/api/apps/auth/login",
    );
    expect(loginUrl.searchParams.get("from_url")).toBe(returnUrl);
    expect(loginUrl.searchParams.get("popup_origin")).toBeNull();
  });
});

describe("getBase44PopupGoogleLoginUrl", () => {
  it("sets popup_origin and callback for production popup OAuth", () => {
    const loginUrl = new URL(
      getBase44PopupGoogleLoginUrl({
        callbackUrl: "https://sidequest-b44.vercel.app/auth/callback",
        popupOrigin: "https://sidequest-b44.vercel.app",
      }),
    );

    expect(loginUrl.origin).toBe("https://app.base44.com");
    expect(loginUrl.searchParams.get("from_url")).toBe(
      "https://sidequest-b44.vercel.app/auth/callback",
    );
    expect(loginUrl.searchParams.get("popup_origin")).toBe(
      "https://sidequest-b44.vercel.app",
    );
    expect(loginUrl.searchParams.get("app_id")).toBeTruthy();
  });
});

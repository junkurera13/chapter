import { describe, expect, it } from "vitest";

import {
  getBase44GoogleLoginUrl,
  getBase44ProductionGoogleLoginUrl,
} from "./base44BrowserClient";

describe("getBase44GoogleLoginUrl", () => {
  it("routes production Google sign-in through the Base44-hosted oauth-start hop", () => {
    expect(
      getBase44GoogleLoginUrl("https://sidequest-b44.vercel.app/app"),
    ).toBe("https://sidequest-b44.base44.app/oauth-start");
  });

  it("keeps local OAuth callbacks on the local development server", () => {
    const returnUrl = "http://localhost:3000/app";
    const loginUrl = new URL(getBase44GoogleLoginUrl(returnUrl));

    expect(loginUrl.origin + loginUrl.pathname).toBe(
      "https://base44.app/api/apps/auth/login",
    );
    expect(loginUrl.searchParams.get("from_url")).toBe(returnUrl);
    expect(loginUrl.searchParams.get("popup_origin")).toBeNull();
  });
});

describe("getBase44ProductionGoogleLoginUrl", () => {
  it("aligns OAuth domain and from_url on the Base44 app host", () => {
    const loginUrl = new URL(getBase44ProductionGoogleLoginUrl());

    expect(loginUrl.searchParams.get("from_url")).toBe(
      "https://sidequest-b44.base44.app/oauth-return",
    );
    expect(loginUrl.searchParams.get("popup_origin")).toBe(
      "https://sidequest-b44.base44.app",
    );
    expect(loginUrl.searchParams.get("app_id")).toBeTruthy();
  });
});

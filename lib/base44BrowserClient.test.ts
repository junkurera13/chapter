import { describe, expect, it } from "vitest";

import { getBase44GoogleLoginUrl } from "./base44BrowserClient";

describe("getBase44GoogleLoginUrl", () => {
  it("routes production OAuth through the Base44-hosted callback bridge", () => {
    const loginUrl = new URL(
      getBase44GoogleLoginUrl("https://sidequest-b44.vercel.app/app"),
    );

    expect(loginUrl.searchParams.get("from_url")).toBe(
      "https://sidequest-b44.base44.app/oauth-return",
    );
  });

  it("keeps local OAuth callbacks on the local development server", () => {
    const returnUrl = "http://localhost:3000/app";
    const loginUrl = new URL(getBase44GoogleLoginUrl(returnUrl));

    expect(loginUrl.searchParams.get("from_url")).toBe(returnUrl);
  });
});

import { describe, expect, it } from "vitest";

import { chapterAuthRedirect } from "./chapter-auth-redirect";

describe("chapterAuthRedirect", () => {
  it("only follows same-origin paths", () => {
    expect(chapterAuthRedirect("/app")).toBe("/app");
    expect(chapterAuthRedirect("/invite/abc")).toBe("/invite/abc");
    expect(chapterAuthRedirect("https://evil.example")).toBe("/app");
    expect(chapterAuthRedirect("//evil.example")).toBe("/app");
    expect(chapterAuthRedirect(undefined)).toBe("/app");
  });
});

import { describe, expect, it } from "vitest";

import {
  isAllowedImessageHandle,
  normalizeImessageHandle,
} from "./imessage-access";

describe("private Chapter iMessage access", () => {
  it("normalizes phone handles without weakening exact matching", () => {
    expect(normalizeImessageHandle("tel:+82 (10) 1234-5678")).toBe(
      "+821012345678",
    );
    expect(normalizeImessageHandle(" JUN@EXAMPLE.COM ")).toBe(
      "jun@example.com",
    );
  });

  it("is closed when no allowlist is configured", () => {
    expect(isAllowedImessageHandle("+821012345678", undefined)).toBe(false);
  });

  it("accepts only an exact configured handle", () => {
    const allowlist = "+82 10 1234 5678, jun@example.com";
    expect(isAllowedImessageHandle("+821012345678", allowlist)).toBe(true);
    expect(isAllowedImessageHandle("jun@example.com", allowlist)).toBe(true);
    expect(isAllowedImessageHandle("+821099999999", allowlist)).toBe(false);
  });
});

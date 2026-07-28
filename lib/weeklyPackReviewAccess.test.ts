import { describe, expect, it } from "vitest";

import { canReviewWeeklyPackUI } from "./weeklyPackReviewAccess";

describe("weekly pack UI review access", () => {
  it("is available only to the owner's account", () => {
    expect(canReviewWeeklyPackUI("parkjundk@gmail.com")).toBe(true);
    expect(canReviewWeeklyPackUI("  PARKJUNDK@GMAIL.COM ")).toBe(true);
    expect(canReviewWeeklyPackUI("someone@example.com")).toBe(false);
    expect(canReviewWeeklyPackUI(undefined)).toBe(false);
  });
});

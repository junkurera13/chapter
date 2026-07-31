import { describe, expect, it } from "vitest";

import { canCreateWeeklyPacks } from "../base44/shared/weekly-pack-creator";

describe("weekly pack creator access", () => {
  it("allows only Jun's normalized account", () => {
    expect(canCreateWeeklyPacks(" parkjundk@gmail.com ")).toBe(true);
    expect(canCreateWeeklyPacks("PARKJUNDK@GMAIL.COM")).toBe(true);
    expect(canCreateWeeklyPacks("someone@example.com")).toBe(false);
    expect(canCreateWeeklyPacks(undefined)).toBe(false);
  });
});

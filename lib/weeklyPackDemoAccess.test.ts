import { describe, expect, it } from "vitest";

import { showsDemoWeeklyPack } from "./weeklyPackDemoAccess";

describe("demo weekly pack access", () => {
  it("is available only to the listed accounts", () => {
    expect(showsDemoWeeklyPack("parkjundk@gmail.com")).toBe(true);
    expect(showsDemoWeeklyPack("  PARKJUNDK@GMAIL.COM ")).toBe(true);
    expect(showsDemoWeeklyPack("someone@example.com")).toBe(false);
    expect(showsDemoWeeklyPack(undefined)).toBe(false);
    expect(showsDemoWeeklyPack("")).toBe(false);
  });
});

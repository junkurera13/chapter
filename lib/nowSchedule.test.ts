import { describe, expect, it } from "vitest";

import {
  addDays,
  canSchedule,
  comingWeekend,
  daysBetween,
  describeWindows,
  formatDay,
  hasPassed,
  isIsoDay,
  sortWindows,
  upcomingDays,
} from "./nowSchedule";

describe("day arithmetic", () => {
  it("moves forwards and backwards across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-08-05", "2026-08-08")).toBe(3);
    expect(daysBetween("2026-08-08", "2026-08-05")).toBe(-3);
  });

  it("survives a spring-forward weekend, which noon-anchoring is for", () => {
    // US clocks jump on 2026-03-08; a midnight-anchored day would lose an hour
    // here and land the answer on the day before.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(daysBetween("2026-03-06", "2026-03-10")).toBe(4);
  });

  it("rejects days that are not real days", () => {
    expect(isIsoDay("2026-08-08")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("8 August")).toBe(false);
    expect(isIsoDay("2026-8-8")).toBe(false);
  });
});

describe("the day the offer names on your behalf", () => {
  // 2026-08-03 is a Monday, so this week runs Mon 3rd to Sun 9th.
  it("points at the coming Saturday from anywhere in the working week", () => {
    expect(comingWeekend("2026-08-03")).toBe("2026-08-08");
    expect(comingWeekend("2026-08-05")).toBe("2026-08-08");
    expect(comingWeekend("2026-08-07")).toBe("2026-08-08");
  });

  it("names today once the weekend has already started", () => {
    // Asking a person on Saturday whether they are free next Saturday is a
    // week of waiting nobody asked for.
    expect(comingWeekend("2026-08-08")).toBe("2026-08-08");
    expect(comingWeekend("2026-08-09")).toBe("2026-08-09");
  });

  it("crosses a month end without leaving August in July", () => {
    // 2026-07-27 is a Monday; its Saturday is the 1st of the next month.
    expect(comingWeekend("2026-07-27")).toBe("2026-08-01");
  });

  it("always names a day that can still be scheduled", () => {
    for (const today of ["2026-08-03", "2026-08-08", "2026-08-09"]) {
      expect(canSchedule(comingWeekend(today), today)).toBe(true);
    }
  });
});

describe("the day a plan is allowed to name", () => {
  it("takes today and refuses yesterday", () => {
    expect(canSchedule("2026-08-08", "2026-08-08")).toBe(true);
    expect(canSchedule("2026-08-07", "2026-08-08")).toBe(false);
    expect(hasPassed("2026-08-08", "2026-08-09")).toBe(true);
    expect(hasPassed("2026-08-08", "2026-08-08")).toBe(false);
  });

  it("reaches to the horizon and stops", () => {
    expect(canSchedule("2026-12-05", "2026-08-08")).toBe(true);
    expect(canSchedule("2027-08-08", "2026-08-08")).toBe(false);
  });
});

describe("how a day reads", () => {
  it("names the near days rather than dating them", () => {
    expect(formatDay("2026-08-08", "2026-08-08")).toBe("Today");
    expect(formatDay("2026-08-09", "2026-08-08")).toBe("Tomorrow");
    expect(formatDay("2026-08-15", "2026-08-08")).toContain("15");
  });

  it("puts windows back in the order a day runs", () => {
    expect(sortWindows(["night", "morning"])).toEqual(["morning", "night"]);
    expect(describeWindows(["evening"])).toBe("Evening");
    expect(describeWindows(["night", "morning"])).toBe("Morning and night");
    expect(describeWindows(["night", "morning", "evening"])).toBe(
      "Morning, evening and night",
    );
    expect(
      describeWindows(["night", "morning", "evening", "afternoon"]),
    ).toBe("All day");
    expect(describeWindows([])).toBe("");
  });
});

describe("the rail of days the form offers", () => {
  it("starts today, so someone free tonight can still say so", () => {
    const days = upcomingDays(4, "2026-08-08");
    expect(days.map((day) => day.iso)).toEqual([
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
    ]);
    expect(days[0].dayOfMonth).toBe(8);
  });

  it("marks where a new month begins", () => {
    const days = upcomingDays(4, "2026-08-30");
    expect(days.map((day) => day.startsMonth)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });
});

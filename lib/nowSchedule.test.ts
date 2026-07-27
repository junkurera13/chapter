import { describe, expect, it } from "vitest";

import {
  addDays,
  canSchedule,
  daysBetween,
  describeWait,
  describeWindows,
  formatDay,
  hasPassed,
  isDueToWrite,
  isIsoDay,
  sortWindows,
  upcomingDays,
  writingDayPhrase,
  writingStartsOn,
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

describe("when Chapter starts writing", () => {
  it("starts three days before the day itself", () => {
    expect(writingStartsOn("2026-08-08")).toBe("2026-08-05");
  });

  it("is not due until the lead time opens", () => {
    expect(isDueToWrite("2026-08-08", "2026-08-04")).toBe(false);
    expect(isDueToWrite("2026-08-08", "2026-08-05")).toBe(true);
  });

  it("stays due when nobody opened the app during the lead time", () => {
    expect(isDueToWrite("2026-08-08", "2026-08-07")).toBe(true);
    expect(isDueToWrite("2026-08-08", "2026-08-08")).toBe(true);
  });

  it("stops being due once the day is gone", () => {
    expect(isDueToWrite("2026-08-08", "2026-08-09")).toBe(false);
    expect(hasPassed("2026-08-08", "2026-08-09")).toBe(true);
    expect(hasPassed("2026-08-08", "2026-08-08")).toBe(false);
  });

  it("accepts a day chosen inside the horizon and nothing outside it", () => {
    expect(canSchedule("2026-08-08", "2026-08-08")).toBe(true);
    expect(canSchedule("2026-08-07", "2026-08-08")).toBe(false);
    expect(canSchedule("2026-12-05", "2026-08-08")).toBe(true);
    expect(canSchedule("2027-08-08", "2026-08-08")).toBe(false);
  });
});

describe("how a schedule reads", () => {
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

  it("names the writing day so it can sit inside a sentence", () => {
    expect(writingDayPhrase("2026-08-08", "2026-08-05")).toBe("today");
    expect(writingDayPhrase("2026-08-08", "2026-08-04")).toBe("tomorrow");
    // Never "Tomorrow" with a capital halfway through a line.
    expect(writingDayPhrase("2026-08-08", "2026-08-01")).toMatch(/^on \w/);
  });

  it("counts down to the writing day, then says it is happening", () => {
    expect(describeWait("2026-08-08", "2026-08-01")).toBe(
      "Chapter starts writing in 4 days",
    );
    expect(describeWait("2026-08-08", "2026-08-04")).toBe(
      "Chapter starts writing tomorrow",
    );
    expect(describeWait("2026-08-08", "2026-08-05")).toBe(
      "Chapter is writing it now",
    );
    expect(describeWait("2026-08-08", "2026-08-07")).toBe(
      "Chapter is writing it now",
    );
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

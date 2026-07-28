import { describe, expect, it } from "vitest";

import {
  isWeeklyPackPreparationDay,
  isWeeklyPackRetryDay,
  localDayAt,
  weeklyPackWindow,
  zonedDateTimeToEpoch,
} from "./weeklyPackSchedule";

describe("weekly pack calendar", () => {
  it("releases at 9am Saturday in Seoul", () => {
    const window = weeklyPackWindow({
      timezone: "Asia/Seoul",
      now: Date.UTC(2026, 6, 29, 3),
    });
    expect(window.weekKey).toBe("2026-08-01");
    expect(new Date(window.releaseAt).toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
    expect(localDayAt(window.expiresAt, "Asia/Seoul")).toBe("2026-08-22");
  });

  it("uses the local Wednesday rather than the server weekday", () => {
    const epoch = Date.UTC(2026, 6, 28, 16);
    expect(
      isWeeklyPackPreparationDay({ timezone: "Asia/Seoul", now: epoch }),
    ).toBe(true);
    expect(
      isWeeklyPackPreparationDay({
        timezone: "America/Los_Angeles",
        now: epoch,
      }),
    ).toBe(false);
  });

  it("reserves local Friday for retries rather than new preparation", () => {
    const epoch = Date.UTC(2026, 6, 31, 3);
    expect(
      isWeeklyPackPreparationDay({ timezone: "Asia/Seoul", now: epoch }),
    ).toBe(false);
    expect(
      isWeeklyPackRetryDay({ timezone: "Asia/Seoul", now: epoch }),
    ).toBe(true);
  });

  it("converts wall time correctly across a DST boundary", () => {
    const epoch = zonedDateTimeToEpoch({
      day: "2026-03-14",
      hour: 9,
      timezone: "America/New_York",
    });
    expect(new Date(epoch).toISOString()).toBe("2026-03-14T13:00:00.000Z");
  });

  it("moves to the following Saturday once this Saturday released", () => {
    const window = weeklyPackWindow({
      timezone: "Asia/Seoul",
      now: Date.UTC(2026, 7, 1, 1),
    });
    expect(window.weekKey).toBe("2026-08-08");
  });
});

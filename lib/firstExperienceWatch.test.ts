import { describe, expect, it } from "vitest";

import {
  firstExperienceWatch,
  isFirstExperienceRefusal,
  NO_FIRST_EXPERIENCE_WATCH,
  type FirstExperienceWatch,
} from "./firstExperienceWatch";
import { NowRequestError } from "./nowClient";

const writing: FirstExperienceWatch = { attempt: 1, status: "writing" };

describe("firstExperienceWatch", () => {
  it("starts writing the moment somebody asks", () => {
    expect(
      firstExperienceWatch(NO_FIRST_EXPERIENCE_WATCH, {
        kind: "asked",
        attempt: 1,
      }),
    ).toEqual({ attempt: 1, status: "writing" });
  });

  it("stops claiming one is coming when the route says nothing is owed", () => {
    expect(
      firstExperienceWatch(writing, { kind: "refused", attempt: 1 }),
    ).toEqual({ attempt: 1, status: "idle" });
  });

  it("says so when the ask itself went wrong", () => {
    expect(
      firstExperienceWatch(writing, { kind: "failed", attempt: 1 }),
    ).toEqual({ attempt: 1, status: "failed" });
  });

  it("ignores an answer to an ask that has been overtaken", () => {
    const second = firstExperienceWatch(writing, { kind: "asked", attempt: 2 });
    expect(
      firstExperienceWatch(second, { kind: "refused", attempt: 1 }),
    ).toEqual(second);
    expect(firstExperienceWatch(second, { kind: "failed", attempt: 1 })).toEqual(
      second,
    );
  });

  it("asking again restarts a wait that had given up", () => {
    const gaveUp = firstExperienceWatch(writing, {
      kind: "settled",
      outcome: "gaveUp",
    });
    expect(gaveUp.status).toBe("failed");
    expect(firstExperienceWatch(gaveUp, { kind: "asked", attempt: 2 })).toEqual({
      attempt: 2,
      status: "writing",
    });
  });

  it("ends quietly when the chapter turns up", () => {
    expect(
      firstExperienceWatch(writing, { kind: "settled", outcome: "found" }),
    ).toEqual({ attempt: 1, status: "idle" });
  });

  it("ends loudly when it never turns up", () => {
    expect(
      firstExperienceWatch(writing, { kind: "settled", outcome: "gaveUp" }),
    ).toEqual({ attempt: 1, status: "failed" });
  });

  it("a wait that is not running cannot end", () => {
    const failed: FirstExperienceWatch = { attempt: 1, status: "failed" };
    expect(
      firstExperienceWatch(failed, { kind: "settled", outcome: "found" }),
    ).toEqual(failed);
    expect(
      firstExperienceWatch(NO_FIRST_EXPERIENCE_WATCH, {
        kind: "settled",
        outcome: "gaveUp",
      }),
    ).toEqual(NO_FIRST_EXPERIENCE_WATCH);
  });
});

describe("isFirstExperienceRefusal", () => {
  it("reads a 409 as nothing owed", () => {
    expect(
      isFirstExperienceRefusal(
        new NowRequestError("Share a memory first.", "NOW_NEEDS_MEMORY", 409),
      ),
    ).toBe(true);
    expect(
      isFirstExperienceRefusal(
        new NowRequestError(
          "Chapter needs your location.",
          "NOW_NEEDS_CITY",
          409,
        ),
      ),
    ).toBe(true);
  });

  it("reads anything else as a failure worth showing", () => {
    expect(
      isFirstExperienceRefusal(
        new NowRequestError("Couldn’t finish that.", "NOW_FAILED", 502),
      ),
    ).toBe(false);
    expect(isFirstExperienceRefusal(new Error("offline"))).toBe(false);
    expect(isFirstExperienceRefusal(undefined)).toBe(false);
  });
});

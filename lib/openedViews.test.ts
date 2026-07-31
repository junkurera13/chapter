import { afterEach, describe, expect, it, vi } from "vitest";

import {
  forgetOpened,
  lastOpened,
  OPENED_GISTS,
  OPENED_NOW,
  OPENED_TOGETHER,
  rememberOpened,
} from "./openedViews";

afterEach(() => {
  vi.useRealTimers();
  forgetOpened(OPENED_NOW, OPENED_TOGETHER, OPENED_GISTS);
});

describe("what a tab last knew", () => {
  it("forgets rather than serves something stale", () => {
    vi.useFakeTimers();
    rememberOpened(OPENED_GISTS, { gists: [{ line: "old" }] });
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(lastOpened(OPENED_GISTS)).toBeDefined();
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(lastOpened(OPENED_GISTS)).toBeUndefined();
  });

  it("drops what an action has just made untrue", () => {
    rememberOpened(OPENED_TOGETHER, { chapters: ["one"] });
    rememberOpened(OPENED_GISTS, { gists: [] });
    forgetOpened(OPENED_TOGETHER, OPENED_GISTS);
    expect(lastOpened(OPENED_TOGETHER)).toBeUndefined();
    expect(lastOpened(OPENED_GISTS)).toBeUndefined();
  });
});

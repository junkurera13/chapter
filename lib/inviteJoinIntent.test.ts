import { beforeEach, describe, expect, it } from "vitest";

import { rememberJoinIntent, takeJoinIntent } from "./inviteJoinIntent";

const CODE = "K7M2QX9RTP";
const OTHER_CODE = "AAAA111122";
const MINUTE = 60 * 1000;

function installStorage(store = new Map<string, string>()) {
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    },
    configurable: true,
  });
  return store;
}

describe("invite join intent", () => {
  beforeEach(() => {
    installStorage();
  });

  it("carries a yes across signing up", () => {
    rememberJoinIntent(CODE, 0);
    expect(takeJoinIntent(CODE, MINUTE)).toBe(true);
  });

  it("never connects anyone who simply opened a link", () => {
    expect(takeJoinIntent(CODE)).toBe(false);
  });

  it("does not accept a different invitation", () => {
    rememberJoinIntent(CODE, 0);
    expect(takeJoinIntent(OTHER_CODE, MINUTE)).toBe(false);
  });

  it("acts once, so a returning visit connects nothing again", () => {
    rememberJoinIntent(CODE, 0);
    expect(takeJoinIntent(CODE, MINUTE)).toBe(true);
    expect(takeJoinIntent(CODE, 2 * MINUTE)).toBe(false);
  });

  it("clears a mismatched intent rather than leaving it armed", () => {
    rememberJoinIntent(CODE, 0);
    expect(takeJoinIntent(OTHER_CODE, MINUTE)).toBe(false);
    expect(takeJoinIntent(CODE, 2 * MINUTE)).toBe(false);
  });

  it("expires an abandoned signup", () => {
    rememberJoinIntent(CODE, 0);
    expect(takeJoinIntent(CODE, 21 * MINUTE)).toBe(false);
  });

  it("still holds just inside the window", () => {
    rememberJoinIntent(CODE, 0);
    expect(takeJoinIntent(CODE, 19 * MINUTE)).toBe(true);
  });

  it("ignores a corrupted or hand-written entry", () => {
    const store = installStorage();
    store.set("chapter.invite-intent.v1", "{not json");
    expect(takeJoinIntent(CODE)).toBe(false);

    store.set("chapter.invite-intent.v1", JSON.stringify({ code: CODE }));
    expect(takeJoinIntent(CODE)).toBe(false);

    store.set("chapter.invite-intent.v1", JSON.stringify({ at: 0 }));
    expect(takeJoinIntent(CODE, MINUTE)).toBe(false);
  });

  it("does nothing at all on the server", () => {
    const restore = globalThis.window;
    // @ts-expect-error deliberately removing window to stand in for the server
    delete globalThis.window;
    expect(() => rememberJoinIntent(CODE)).not.toThrow();
    expect(takeJoinIntent(CODE)).toBe(false);
    Object.defineProperty(globalThis, "window", {
      value: restore,
      configurable: true,
    });
  });
});

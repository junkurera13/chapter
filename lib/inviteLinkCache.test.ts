import { beforeEach, describe, expect, it } from "vitest";

import {
  cacheInviteUrl,
  forgetCachedInviteUrl,
  readCachedInviteUrl,
} from "./inviteLinkCache";

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

describe("inviteLinkCache", () => {
  beforeEach(() => {
    installStorage();
  });

  it("hands back the link it was given", () => {
    cacheInviteUrl("node-a", "https://usechapter.vercel.app/i/K7M2QX9RTP");
    expect(readCachedInviteUrl("node-a")).toBe(
      "https://usechapter.vercel.app/i/K7M2QX9RTP",
    );
  });

  it("keeps each person's link apart", () => {
    cacheInviteUrl("node-a", "https://example.test/i/AAAAAAAAAA");
    cacheInviteUrl("node-b", "https://example.test/i/BBBBBBBBBB");
    expect(readCachedInviteUrl("node-a")).toBe("https://example.test/i/AAAAAAAAAA");
    expect(readCachedInviteUrl("node-b")).toBe("https://example.test/i/BBBBBBBBBB");
  });

  it("replaces a link when the backend returns a different one", () => {
    cacheInviteUrl("node-a", "https://example.test/i/AAAAAAAAAA");
    cacheInviteUrl("node-a", "https://example.test/i/CCCCCCCCCC");
    expect(readCachedInviteUrl("node-a")).toBe("https://example.test/i/CCCCCCCCCC");
  });

  it("forgets a spent link", () => {
    cacheInviteUrl("node-a", "https://example.test/i/AAAAAAAAAA");
    forgetCachedInviteUrl("node-a");
    expect(readCachedInviteUrl("node-a")).toBeUndefined();
  });

  it("is quiet about a person it never saw", () => {
    expect(readCachedInviteUrl("node-zzz")).toBeUndefined();
    expect(() => forgetCachedInviteUrl("node-zzz")).not.toThrow();
  });

  it("ignores a corrupted store rather than breaking the button", () => {
    const store = installStorage();
    store.set("chapter.invite-links.v1", "{not json");
    expect(readCachedInviteUrl("node-a")).toBeUndefined();
    expect(() => cacheInviteUrl("node-a", "https://example.test/i/AAAAAAAAAA"))
      .not.toThrow();
  });

  it("survives storage that refuses to write", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: () => null,
          setItem: () => {
            throw new Error("QuotaExceededError");
          },
          removeItem: () => {},
        },
      },
      configurable: true,
    });
    expect(() => cacheInviteUrl("node-a", "https://example.test/i/AAAAAAAAAA"))
      .not.toThrow();
  });

  it("does nothing at all on the server", () => {
    const restore = globalThis.window;
    // @ts-expect-error deliberately removing window to stand in for the server
    delete globalThis.window;
    expect(readCachedInviteUrl("node-a")).toBeUndefined();
    expect(() => cacheInviteUrl("node-a", "https://example.test/i/A")).not.toThrow();
    Object.defineProperty(globalThis, "window", {
      value: restore,
      configurable: true,
    });
  });
});

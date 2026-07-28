import { describe, expect, it } from "vitest";

import type { IntroductionRecord } from "./introductionSchema";
import type { TogetherChapterRecord } from "./togetherChapterSchema";
import type { TogetherGist } from "./togetherGistSchema";
import { buildEntries, isOpen, priorityOf } from "./togetherEntries";

function gist(connectionId: string, partnerName: string): TogetherGist {
  return {
    connectionId,
    partnerName,
    line: `You and ${partnerName} both know Mojiko.`,
    anchors: [{ label: "Mojiko", category: "place" }],
  };
}

function introduction(
  id: string,
  state: IntroductionRecord["state"] = "ready",
): IntroductionRecord {
  return {
    id,
    partnerName: "Mina",
    line: "Mina knows Mojiko too.",
    anchors: [{ label: "Mojiko", category: "place" }],
    state,
    expiresAt: 1_800_000_000_000,
  };
}

function chapter(
  connectionId: string,
  partnerName: string,
  status: string,
  role: "initiator" | "partner" = "initiator",
) {
  return {
    id: `chapter-${connectionId}`,
    connectionId,
    partnerName,
    status,
    role,
    createdAt: 1,
    evidence: [],
    youLived: false,
    theyLived: false,
  } as unknown as TogetherChapterRecord;
}

describe("buildEntries", () => {
  it("gives one person one card, not one per thing known about them", () => {
    const entries = buildEntries(
      [chapter("c1", "Samuel", "draft")],
      [gist("c1", "Samuel")],
      [],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].gist).toBeDefined();
    expect(entries[0].chapter).toBeDefined();
    expect(entries[0].partnerName).toBe("Samuel");
  });

  it("carries the name on a gist without making a connection", () => {
    const [entry] = buildEntries([], [], [introduction("i1")]);

    expect(entry.id).toBe("i1");
    expect(entry.partnerName).toBe("Mina");
    expect(entry.introduction).toBeDefined();
    expect(entry.gist).toBeUndefined();
  });

  it("puts strangers and friends in one list", () => {
    const entries = buildEntries([], [gist("c1", "Samuel")], [
      introduction("i1"),
    ]);
    expect(entries).toHaveLength(2);
  });

  it("leads with a chapter a friend is waiting on, then the thing that expires", () => {
    const entries = buildEntries(
      [chapter("c1", "Samuel", "proposed", "partner")],
      [gist("c2", "Daniel")],
      [introduction("i1")],
    );

    expect(entries.map((entry) => entry.id)).toEqual(["c1", "i1", "c2"]);
  });

  it("puts a sent request below a gist waiting for a first message", () => {
    const [entry] = buildEntries([], [], [introduction("i1", "sent")]);
    expect(priorityOf(entry)).toBeGreaterThan(
      priorityOf({ id: "x", introduction: introduction("i2") }),
    );
  });

  it("keeps a sent request visible, then sorts ordinary gists alphabetically", () => {
    const entries = buildEntries(
      [],
      [gist("c2", "Samuel"), gist("c1", "Daniel")],
      [{ ...introduction("i1", "sent"), partnerName: "Zoe" }],
    );

    expect(entries.map((entry) => entry.partnerName)).toEqual([
      "Zoe",
      "Daniel",
      "Samuel",
    ]);
  });

  it("keeps a name the gist knows when a chapter arrives for the same person", () => {
    const entries = buildEntries(
      [chapter("c1", "Sam", "researching")],
      [gist("c1", "Samuel")],
      [],
    );
    expect(entries[0].partnerName).toBe("Samuel");
  });

  it("leaves finished chapters off the page", () => {
    expect(buildEntries([chapter("c1", "Samuel", "lived")], [], [])).toEqual([]);
    expect(buildEntries([chapter("c1", "Samuel", "declined")], [], [])).toEqual(
      [],
    );
  });
});

describe("isOpen", () => {
  it("counts every stage a chapter is still in motion", () => {
    for (const status of ["researching", "draft", "proposed", "accepted"]) {
      expect(isOpen(chapter("c1", "Samuel", status))).toBe(true);
    }
    for (const status of ["lived", "declined", "failed"]) {
      expect(isOpen(chapter("c1", "Samuel", status))).toBe(false);
    }
  });
});

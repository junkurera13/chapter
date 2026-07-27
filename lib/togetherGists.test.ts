import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TogetherPlanningGraph } from "./togetherChapterSchema";

const generateStructured = vi.hoisted(() => vi.fn());

vi.mock("./nowGeneration", async () => {
  const actual = await vi.importActual<typeof import("./nowGeneration")>(
    "./nowGeneration",
  );
  return { ...actual, generateStructured };
});

const {
  buildGistPrompt,
  fallbackGistLine,
  findGistAnchors,
  generateGistLines,
} = await import("./togetherGists");

function graph(
  nodes: Array<{
    id: string;
    label: string;
    category?: string;
    salience?: number;
  }>,
): TogetherPlanningGraph {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.label,
      category: node.category ?? "activity",
      salience: node.salience ?? 0.7,
    })),
  };
}

describe("findGistAnchors", () => {
  it("keeps only labels both worlds hold", () => {
    const anchors = findGistAnchors({
      mine: graph([
        { id: "mine-1", label: "cycling" },
        { id: "mine-2", label: "Mojiko", category: "place" },
        { id: "mine-3", label: "night diving" },
      ]),
      theirs: graph([
        { id: "theirs-1", label: "Cycling" },
        { id: "theirs-2", label: "Mojiko", category: "place" },
        { id: "theirs-3", label: "pottery" },
      ]),
    });

    expect(anchors.map((anchor) => anchor.label).sort()).toEqual([
      "Mojiko",
      "cycling",
    ]);
  });

  it("resolves the reader's own node id so the orb can light up", () => {
    const [anchor] = findGistAnchors({
      mine: graph([{ id: "mine-1", label: "cycling" }]),
      theirs: graph([{ id: "theirs-1", label: "cycling" }]),
    });

    expect(anchor.nodeId).toBe("mine-1");
  });

  it("never carries a label only the other person holds", () => {
    const anchors = findGistAnchors({
      mine: graph([{ id: "mine-1", label: "cycling" }]),
      theirs: graph([
        { id: "theirs-1", label: "cycling" },
        { id: "theirs-2", label: "grief counselling", category: "interest" },
      ]),
    });

    expect(anchors.map((anchor) => anchor.label)).toEqual(["cycling"]);
  });

  it("drops categories that may not be spoken aloud", () => {
    const anchors = findGistAnchors({
      mine: graph([{ id: "mine-1", label: "loneliness", category: "feeling" }]),
      theirs: graph([
        { id: "theirs-1", label: "loneliness", category: "feeling" },
      ]),
    });

    expect(anchors).toEqual([]);
  });

  it("ranks by what the thread is worth to the two of them together", () => {
    const anchors = findGistAnchors({
      mine: graph([
        { id: "mine-1", label: "coffee", salience: 0.9 },
        { id: "mine-2", label: "cycling", salience: 0.8 },
        { id: "mine-3", label: "records", salience: 0.75 },
        { id: "mine-4", label: "ramen", salience: 0.7 },
      ]),
      theirs: graph([
        { id: "theirs-1", label: "coffee", salience: 0.1 },
        { id: "theirs-2", label: "cycling", salience: 0.95 },
        { id: "theirs-3", label: "records", salience: 0.9 },
        { id: "theirs-4", label: "ramen", salience: 0.85 },
      ]),
    });

    expect(anchors.map((anchor) => anchor.label)).toEqual([
      "cycling",
      "records",
      "ramen",
    ]);
  });
});

describe("buildGistPrompt", () => {
  it("carries each pair's labels and forbids match-speak", () => {
    const prompt = buildGistPrompt([
      {
        connectionId: "connection-1",
        partnerName: "Samuel",
        anchors: [
          { label: "cycling", category: "activity" },
          { label: "Mojiko", category: "place" },
        ],
      },
    ]);

    expect(prompt).toContain("Samuel");
    expect(prompt).toContain("cycling");
    expect(prompt).toContain("Mojiko");
    expect(prompt).toContain("VERBATIM");
    expect(prompt).toContain("both like");
  });
});

describe("fallbackGistLine", () => {
  it("says the true thing plainly", () => {
    expect(
      fallbackGistLine({
        connectionId: "connection-1",
        partnerName: "Samuel",
        anchors: [
          { label: "cycling", category: "activity" },
          { label: "Mojiko", category: "place" },
        ],
      }),
    ).toBe("You and Samuel both know cycling and Mojiko.");
  });
});

describe("generateGistLines", () => {
  beforeEach(() => {
    generateStructured.mockClear();
  });

  const thread = {
    connectionId: "connection-1",
    partnerName: "Samuel",
    anchors: [
      { label: "cycling", category: "activity", nodeId: "mine-1" },
      { label: "Mojiko", category: "place", nodeId: "mine-2" },
    ],
  };

  it("returns the written line with its anchors intact", async () => {
    generateStructured.mockResolvedValueOnce({
      lines: [
        {
          index: 0,
          line: "You and Samuel both know the feeling of cycling around Mojiko.",
        },
      ],
    });

    const [gist] = await generateGistLines({
      threads: [thread],
      requestId: "request-1",
    });

    expect(gist.line).toBe(
      "You and Samuel both know the feeling of cycling around Mojiko.",
    );
    expect(gist.anchors.map((anchor) => anchor.label)).toEqual([
      "cycling",
      "Mojiko",
    ]);
  });

  it("drops anchors the sentence never names, so no orb floats alone", async () => {
    generateStructured.mockResolvedValueOnce({
      lines: [{ index: 0, line: "You and Samuel both ride the same roads." }],
    });

    const [gist] = await generateGistLines({
      threads: [thread],
      requestId: "request-1",
    });

    expect(gist.anchors).toEqual([]);
  });

  it("falls back to the plain line when the model can't be reached", async () => {
    generateStructured.mockRejectedValueOnce(new Error("upstream is down"));

    const [gist] = await generateGistLines({
      threads: [thread],
      requestId: "request-1",
    });

    expect(gist.line).toBe("You and Samuel both know cycling and Mojiko.");
    expect(gist.anchors).toHaveLength(2);
  });

  it("writes every pair in one call", async () => {
    generateStructured.mockResolvedValueOnce({
      lines: [
        { index: 0, line: "You and Samuel both know cycling in Mojiko." },
        { index: 1, line: "You and Aron both know the pull of records." },
      ],
    });

    const gists = await generateGistLines({
      threads: [
        thread,
        {
          connectionId: "connection-2",
          partnerName: "Aron",
          anchors: [{ label: "records", category: "interest" }],
        },
      ],
      requestId: "request-1",
    });

    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(gists.map((gist) => gist.connectionId)).toEqual([
      "connection-1",
      "connection-2",
    ]);
  });

  it("asks for nothing when no world overlaps", async () => {
    const gists = await generateGistLines({
      threads: [{ ...thread, anchors: [] }],
      requestId: "request-1",
    });

    expect(gists).toEqual([]);
    expect(generateStructured).not.toHaveBeenCalled();
  });
});

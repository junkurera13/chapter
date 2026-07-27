import { describe, expect, it, vi } from "vitest";

import type {
  ExperienceGraphNodeRecord,
  ExperienceGraphRecord,
} from "./backendTypes";
import type { TogetherPlanningGraph } from "./togetherChapterSchema";

const generateStructured = vi.hoisted(() => vi.fn());

vi.mock("./nowGeneration", async () => {
  const actual = await vi.importActual<typeof import("./nowGeneration")>(
    "./nowGeneration",
  );
  return { ...actual, generateStructured };
});

const {
  buildPlanningDigest,
  buildTogetherBriefPrompt,
  buildTogetherComposePrompt,
  generateTogetherBrief,
  normalizeLabel,
  planningGraphFrom,
  sharedLabels,
} = await import("./togetherGeneration");

function node(
  partial: Partial<ExperienceGraphNodeRecord> & { id: string; label: string },
): ExperienceGraphNodeRecord {
  return {
    sourceType: "memory",
    category: "activity",
    subtype: "activity",
    kind: "activity",
    description: "",
    certainty: "fact",
    confidence: 0.8,
    salience: 0.7,
    evidence: "",
    createdAt: 0,
    ...partial,
  } as ExperienceGraphNodeRecord;
}

function graph(nodes: ExperienceGraphNodeRecord[]): ExperienceGraphRecord {
  return { memoryCount: nodes.length, nodes, edges: [] };
}

function planning(
  nodes: { id: string; label: string; category?: string; salience?: number }[],
): TogetherPlanningGraph {
  return {
    nodes: nodes.map((entry) => ({
      id: entry.id,
      label: entry.label,
      category: entry.category ?? "activity",
      salience: entry.salience ?? 0.7,
    })),
  };
}

describe("planningGraphFrom", () => {
  it("keeps only categories that are safe to name in a shared invitation", () => {
    const reduced = planningGraphFrom(
      graph([
        node({ id: "a", label: "Cycling", category: "activity" }),
        node({ id: "b", label: "Fukuoka", category: "place" }),
        node({ id: "c", label: "Jazz", category: "interest" }),
        node({ id: "d", label: "Grief", category: "feeling" }),
        node({ id: "e", label: "Daniel", category: "people" }),
        node({ id: "f", label: "The night I quit", category: "experience" }),
        node({ id: "g", label: "Early riser", category: "pattern" }),
        node({ id: "h", label: "Recovering", category: "condition" }),
      ]),
    );

    expect(reduced.nodes.map((entry) => entry.label)).toEqual([
      "Cycling",
      "Fukuoka",
      "Jazz",
    ]);
  });
});

describe("buildPlanningDigest", () => {
  it("drops node ids so the prompt never sees them", () => {
    const digest = buildPlanningDigest(planning([{ id: "a", label: "Cycling" }]));
    expect(digest.nodes[0]).toEqual({
      label: "Cycling",
      category: "activity",
      salience: 0.7,
    });
    expect(JSON.stringify(digest)).not.toContain("\"a\"");
  });

  it("de-duplicates labels that differ only in typography", () => {
    const digest = buildPlanningDigest(
      planning([
        { id: "a", label: "Cycling", salience: 0.9 },
        { id: "b", label: "cycling", salience: 0.4 },
      ]),
    );
    expect(digest.nodes).toHaveLength(1);
    expect(digest.nodes[0].label).toBe("Cycling");
  });
});

describe("normalizeLabel", () => {
  it("matches the same thing written two ways", () => {
    expect(normalizeLabel("Dad’s ramen shop")).toBe(
      normalizeLabel("dads ramen shop"),
    );
  });
});

describe("sharedLabels", () => {
  it("finds the ground both worlds already hold", () => {
    const shared = sharedLabels(
      buildPlanningDigest(
        planning([
          { id: "a", label: "Cycling" },
          { id: "b", label: "Pottery" },
        ]),
      ),
      buildPlanningDigest(
        planning([
          { id: "x", label: "cycling" },
          { id: "y", label: "Surfing" },
        ]),
      ),
    );
    expect(shared.map((entry) => entry.label)).toEqual(["Cycling"]);
  });
});

describe("buildTogetherBriefPrompt", () => {
  it("forbids reporting one world to the other", () => {
    const prompt = buildTogetherBriefPrompt({
      initiator: buildPlanningDigest(planning([{ id: "a", label: "Cycling" }])),
      partner: buildPlanningDigest(planning([{ id: "x", label: "Cycling" }])),
      shared: [{ label: "Cycling", category: "activity", salience: 0.7 }],
      homeCity: "Fukuoka",
      partnerName: "Daniel",
    });
    expect(prompt).toContain("DISCLOSURE RULE");
    expect(prompt).toContain("you both");
    expect(prompt).toContain("Fukuoka");
  });
});

describe("buildTogetherComposePrompt", () => {
  it("bars names, because one text is read by both people", () => {
    const prompt = buildTogetherComposePrompt({
      brief: {
        anchors: [{ label: "Cycling", category: "activity" }],
        stretch: { dimension: "place", description: "a coast road neither has ridden" },
      },
      finding: {
        venue_name: "Itoshima Coast Road",
        venue_area: "Itoshima, Fukuoka",
        why_uncommon: "No English coverage at all.",
        best_time: "Saturday, early.",
      },
      homeCity: "Fukuoka",
    });
    expect(prompt).toContain("never use anyone's name");
    expect(prompt).toContain("DISCLOSURE RULE");
  });
});

describe("generateTogetherBrief", () => {
  const initiatorGraph = planning([
    { id: "i-cycling", label: "Cycling" },
    { id: "i-coffee", label: "Coffee" },
  ]);
  const partnerGraph = planning([
    { id: "p-cycling", label: "cycling" },
    { id: "p-pottery", label: "Pottery" },
  ]);

  const draft = {
    threadTitle: "Two wheels, one coast",
    anchorLabels: ["Cycling", "Pottery"],
    stretch: {
      dimension: "place" as const,
      description: "a coast road neither of them has ridden",
    },
    researchObjective: "x".repeat(120),
  };

  it("resolves each anchor into the ids of whichever worlds hold it", async () => {
    generateStructured.mockResolvedValueOnce(draft);

    const brief = await generateTogetherBrief({
      initiatorGraph,
      partnerGraph,
      homeCity: "Fukuoka",
      partnerName: "Daniel",
      requestId: "test",
    });

    expect(brief.anchors).toEqual([
      {
        label: "Cycling",
        category: "activity",
        initiatorNodeId: "i-cycling",
        partnerNodeId: "p-cycling",
      },
      {
        label: "Pottery",
        category: "activity",
        partnerNodeId: "p-pottery",
      },
    ]);
  });

  it("drops anchors neither world holds, rather than claiming a memory", async () => {
    generateStructured.mockResolvedValueOnce({
      ...draft,
      anchorLabels: ["Cycling", "Paragliding"],
    });

    const brief = await generateTogetherBrief({
      initiatorGraph,
      partnerGraph,
      homeCity: "Fukuoka",
      partnerName: "Daniel",
      requestId: "test",
    });

    expect(brief.anchors.map((anchor) => anchor.label)).toEqual(["Cycling"]);
  });

  it("fails rather than proposing something anchored in nothing", async () => {
    generateStructured.mockResolvedValueOnce({
      ...draft,
      anchorLabels: ["Paragliding"],
    });

    await expect(
      generateTogetherBrief({
        initiatorGraph,
        partnerGraph,
        homeCity: "Fukuoka",
        partnerName: "Daniel",
        requestId: "test",
      }),
    ).rejects.toThrow(/did not anchor/i);
  });

  it("never shows the model a node id from either world", async () => {
    generateStructured.mockResolvedValueOnce(draft);

    await generateTogetherBrief({
      initiatorGraph,
      partnerGraph,
      homeCity: "Fukuoka",
      partnerName: "Daniel",
      requestId: "test",
    });

    const prompt = generateStructured.mock.calls.at(-1)?.[0].prompt as string;
    expect(prompt).not.toContain("i-cycling");
    expect(prompt).not.toContain("p-pottery");
  });
});

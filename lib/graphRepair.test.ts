import { describe, expect, it } from "vitest";

import type {
  ExperienceGraphEdgeRecord,
  ExperienceGraphNodeRecord,
  ExperienceGraphRecord,
} from "./backendTypes";
import { repairExperienceGraph } from "./graphRepair";

function node(
  id: string,
  category: ExperienceGraphNodeRecord["category"],
  label: string,
): ExperienceGraphNodeRecord {
  return {
    id,
    sourceType: "memory",
    category,
    subtype: category,
    kind: category,
    label,
    description: `${label} description`,
    certainty: "fact",
    confidence: 0.9,
    salience: 0.7,
    evidence: `${label} evidence`,
    createdAt: 1,
  };
}

function edge(
  fromNodeId: string,
  toNodeId: string,
): ExperienceGraphEdgeRecord {
  return {
    id: `${fromNodeId}-${toNodeId}`,
    memoryId: "memory-1",
    fromNodeId,
    toNodeId,
    relation: "involved",
    polarity: "neutral",
    familiarity: "not_applicable",
    strength: 0.8,
    certainty: "fact",
    createdAt: 1,
  };
}

function graph(
  nodes: ExperienceGraphNodeRecord[],
  edges: ExperienceGraphEdgeRecord[],
): ExperienceGraphRecord {
  return { memoryCount: 1, nodes, edges };
}

describe("repairExperienceGraph", () => {
  it("links an activity to the person its label names and trims the clause", () => {
    const repaired = repairExperienceGraph(
      graph(
        [
          node("moment", "experience", "Last Birthday"),
          node("halmoni", "people", "Halmoni"),
          node("tiramisu", "activity", "Sharing Tiramisu Cake with Halmoni"),
        ],
        [edge("moment", "halmoni"), edge("moment", "tiramisu")],
      ),
    );

    const activity = repaired.nodes.find((n) => n.id === "tiramisu")!;
    expect(activity.label).toBe("Sharing Tiramisu Cake");
    expect(
      repaired.edges.some(
        (e) =>
          (e.fromNodeId === "tiramisu" && e.toNodeId === "halmoni") ||
          (e.fromNodeId === "halmoni" && e.toNodeId === "tiramisu"),
      ),
    ).toBe(true);
  });

  it("keeps possessive labels but still links them to the person", () => {
    const repaired = repairExperienceGraph(
      graph(
        [
          node("halmoni", "people", "Halmoni"),
          node("gift", "condition", "Halmoni's Gift Money"),
        ],
        [],
      ),
    );

    expect(repaired.nodes.find((n) => n.id === "gift")!.label).toBe(
      "Halmoni's Gift Money",
    );
    expect(
      repaired.edges.some(
        (e) =>
          (e.fromNodeId === "gift" && e.toNodeId === "halmoni") ||
          (e.fromNodeId === "halmoni" && e.toNodeId === "gift"),
      ),
    ).toBe(true);
  });

  it("does not trim clauses that name no known person", () => {
    const input = graph(
      [
        node("halmoni", "people", "Halmoni"),
        node("skewers", "activity", "Eating Meat Skewers with Friends"),
      ],
      [],
    );
    const repaired = repairExperienceGraph(input);

    expect(repaired.nodes.find((n) => n.id === "skewers")!.label).toBe(
      "Eating Meat Skewers with Friends",
    );
    expect(repaired.edges).toHaveLength(0);
  });

  it("adds no duplicate edge when the pair is already connected", () => {
    const repaired = repairExperienceGraph(
      graph(
        [
          node("halmoni", "people", "Halmoni"),
          node("tiramisu", "activity", "Sharing Tiramisu with Halmoni"),
        ],
        [edge("tiramisu", "halmoni")],
      ),
    );

    expect(repaired.edges).toHaveLength(1);
    expect(repaired.nodes.find((n) => n.id === "tiramisu")!.label).toBe(
      "Sharing Tiramisu",
    );
  });

  it("ignores partial-word matches", () => {
    const repaired = repairExperienceGraph(
      graph(
        [
          node("sam", "people", "Sam"),
          node("activity", "activity", "Making Samgyetang"),
        ],
        [],
      ),
    );

    expect(repaired.edges).toHaveLength(0);
    expect(repaired.nodes.find((n) => n.id === "activity")!.label).toBe(
      "Making Samgyetang",
    );
  });

  it("returns the graph unchanged when nothing needs repair", () => {
    const input = graph(
      [
        node("halmoni", "people", "Halmoni"),
        node("tiramisu", "activity", "Sharing Tiramisu Cake"),
      ],
      [edge("tiramisu", "halmoni")],
    );

    expect(repairExperienceGraph(input)).toBe(input);
  });
});

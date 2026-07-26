import { describe, expect, it } from "vitest";

import type { ExperienceGraphRecord } from "../../lib/backendTypes";
import { buildWorldGraph } from "./graphData";

describe("buildWorldGraph", () => {
  it("uses persisted node ids and relationships around one presentation-only centre", () => {
    const graph: ExperienceGraphRecord = {
      memoryCount: 1,
      nodes: [
        {
          id: "memory-node-id",
          memoryId: "memory-id",
          sourceType: "memory",
          category: "experience",
          subtype: "meaningful_memory",
          kind: "memory",
          label: "The night walk",
          description: "A long walk that became unexpectedly meaningful.",
          certainty: "fact",
          confidence: 1,
          salience: 1,
          evidence: "We kept walking for hours.",
          createdAt: 1,
        },
        {
          id: "feeling-node-id",
          memoryId: "memory-id",
          sourceType: "memory",
          category: "feeling",
          subtype: "calm",
          kind: "emotion",
          label: "Calm",
          description: "The city felt quieter than usual.",
          certainty: "fact",
          confidence: 0.9,
          salience: 0.7,
          evidence: "Everything felt calm.",
          createdAt: 2,
        },
      ],
      edges: [
        {
          id: "edge-id",
          memoryId: "memory-id",
          fromNodeId: "memory-node-id",
          toNodeId: "feeling-node-id",
          relation: "evoked",
          polarity: "positive",
          familiarity: "mixed",
          strength: 0.9,
          certainty: "fact",
          createdAt: 3,
        },
      ],
    };

    const world = buildWorldGraph(graph);

    expect(world.nodes.map((node) => node.key)).toEqual([
      "self",
      "memory-node-id",
      "feeling-node-id",
    ]);
    expect(world.nodes.find((node) => node.key === "memory-node-id")?.label).toBe(
      "The night walk",
    );
    expect(world.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "self",
          to: "memory-node-id",
          role: "root",
        }),
        expect.objectContaining({
          from: "memory-node-id",
          to: "feeling-node-id",
          relation: "evoked",
          role: "relation",
        }),
      ]),
    );
  });

  it("anchors reciprocal connection nodes directly to the viewer", () => {
    const graph: ExperienceGraphRecord = {
      memoryCount: 0,
      nodes: [
        {
          id: "friend-node-id",
          sourceType: "connection",
          linkedUserId: "friend-user-id",
          connectionId: "connection-id",
          category: "people",
          subtype: "friend",
          kind: "person",
          label: "Jun",
          description: "A friend you connected with through Sidequest.",
          certainty: "fact",
          confidence: 1,
          salience: 0.82,
          evidence: "You connected through a private Sidequest invitation.",
          createdAt: 1,
        },
      ],
      edges: [],
    };

    const world = buildWorldGraph(graph);

    expect(world.edges).toContainEqual(
      expect.objectContaining({
        from: "self",
        to: "friend-node-id",
        role: "root",
      }),
    );
    expect(world.nodes.find((node) => node.key === "friend-node-id")).toEqual(
      expect.objectContaining({
        sourceType: "connection",
        linkedUserId: "friend-user-id",
        connectionId: "connection-id",
        description: "A friend you connected with through Chapter.",
        evidence: "You connected through a private Chapter invitation.",
      }),
    );
  });
});

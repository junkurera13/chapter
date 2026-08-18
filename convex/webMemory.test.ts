/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const memory = {
  clientRequestId: "memory-request-1",
  source: "onboarding" as const,
  rawText: "Cycling beside the river with my brother after the rain.",
  title: "After the rain",
  summary: "A quiet river ride shared with a sibling.",
  sources: [],
  nodes: [
    {
      localKey: "memory",
      category: "experience" as const,
      subtype: "meaningful_memory",
      label: "River ride",
      description: "A bicycle ride beside the river after rainfall.",
      certainty: "fact" as const,
      confidence: 0.98,
      salience: 0.9,
      evidence: "The person described cycling beside the river.",
    },
  ],
  edges: [],
};

describe("Chapter web memory ownership", () => {
  test("is account-owned and idempotent at the client request boundary", async () => {
    const t = convexTest(schema, modules);
    const firstUser = t.withIdentity({ subject: "first-user", name: "First" });
    const secondUser = t.withIdentity({ subject: "second-user", name: "Second" });

    await firstUser.mutation(api.accounts.ensureCurrent, { displayName: "First" });
    await secondUser.mutation(api.accounts.ensureCurrent, { displayName: "Second" });

    expect(await firstUser.mutation(api.webMemory.persistExtraction, memory)).toMatchObject({
      created: true,
      title: memory.title,
    });
    expect(await firstUser.mutation(api.webMemory.persistExtraction, memory)).toMatchObject({
      created: false,
      title: memory.title,
    });

    expect(await firstUser.query(api.webMemory.graph, {})).toMatchObject({ memoryCount: 1 });
    expect(await secondUser.query(api.webMemory.graph, {})).toMatchObject({
      memoryCount: 0,
      nodes: [],
      edges: [],
    });
  });

  test("maps retired interest into activity and drops feeling", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "graph-user", name: "Graph" });
    await user.mutation(api.accounts.ensureCurrent, { displayName: "Graph" });

    await user.mutation(api.webMemory.persistExtraction, {
      ...memory,
      clientRequestId: "retired-categories",
      nodes: [
        memory.nodes[0],
        {
          localKey: "tea",
          category: "interest" as const,
          subtype: "cuisine",
          label: "Earl Grey",
          description: "A tea flavour from the memory.",
          certainty: "fact" as const,
          confidence: 0.8,
          salience: 0.7,
          evidence: "The person named Earl Grey ice cream.",
        },
        {
          localKey: "calm",
          category: "feeling" as const,
          subtype: "calm",
          label: "Calm",
          description: "A guessed mood.",
          certainty: "hypothesis" as const,
          confidence: 0.4,
          salience: 0.3,
          evidence: "Not stated directly.",
        },
      ],
    });

    const graph = await user.query(api.webMemory.graph, {});
    expect(graph.nodes.map((node) => node.category).sort()).toEqual([
      "activity",
      "experience",
    ]);
    expect(graph.nodes.map((node) => node.label).sort()).toEqual([
      "Earl Grey",
      "River ride",
    ]);
  });
});

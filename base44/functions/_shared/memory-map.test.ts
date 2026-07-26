import { describe, expect, it } from "vitest";

import {
  buildMemoryExtractionPrompt,
  collapseMemoryGraphRows,
  memoryExtractionSchema,
  prepareMemoryExtraction,
  type MemorySourceDescriptor,
} from "../../shared/memory-map";

const textSource: MemorySourceDescriptor = {
  ref: "text:main",
  type: "text",
  text: "Alex and I walked through Mojiko at sunset.",
};

function momentNode(sourceRefs = ["text:main"]) {
  return {
    local_key: "moment",
    existing_key: "",
    category: "experience",
    subtype: "meaningful_memory",
    label: "Mojiko at sunset",
    description: "A sunset walk through Mojiko.",
    basis: sourceRefs[0].startsWith("image") ? "visible" : "explicit",
    confidence: 0.95,
    salience: 1,
    evidence: "The memory centres on a sunset walk.",
    source_refs: sourceRefs,
    prior_support_keys: [],
  };
}

function rawExtraction(
  nodes: Array<Record<string, unknown>>,
  edges: Array<Record<string, unknown>> = [],
) {
  return {
    title: "Mojiko at sunset",
    summary: "A sunset walk through Mojiko became a vivid shared memory.",
    nodes,
    edges,
  };
}

describe("memory map extraction guardrails", () => {
  it("keeps provider-rejected collection constraints out of the LLM schema", () => {
    const serialized = JSON.stringify(memoryExtractionSchema);

    expect(serialized).not.toContain('"additionalProperties"');
    expect(serialized).not.toContain('"minItems"');
    expect(serialized).not.toContain('"maxItems"');
  });

  it("keeps visible facts but rejects feelings, interests, and patterns inferred from pixels alone", () => {
    const imageSource: MemorySourceDescriptor = {
      ref: "image:0",
      type: "image",
      attachmentIndex: 0,
    };
    const extraction = prepareMemoryExtraction(
      rawExtraction([
        momentNode(["image:0"]),
        {
          local_key: "waterfront",
          existing_key: "",
          category: "place",
          subtype: "waterfront",
          label: "Waterfront",
          description: "A paved waterfront beside the water.",
          basis: "visible",
          confidence: 0.94,
          salience: 0.7,
          evidence: "A waterfront is visible.",
          source_refs: ["image:0"],
          prior_support_keys: [],
        },
        {
          local_key: "joy",
          existing_key: "",
          category: "feeling",
          subtype: "joy",
          label: "Joy",
          description: "The user felt joyful.",
          basis: "visible",
          confidence: 0.9,
          salience: 0.7,
          evidence: "People appear to be smiling.",
          source_refs: ["image:0"],
          prior_support_keys: [],
        },
        {
          local_key: "travel",
          existing_key: "",
          category: "interest",
          subtype: "travel",
          label: "Travel",
          description: "The user loves travelling.",
          basis: "inferred",
          confidence: 0.8,
          salience: 0.7,
          evidence: "The image appears to be from a trip.",
          source_refs: ["image:0"],
          prior_support_keys: [],
        },
        {
          local_key: "adventure",
          existing_key: "",
          category: "pattern",
          subtype: "recurring_preference",
          label: "Always adventurous",
          description: "The user repeatedly seeks adventure.",
          basis: "recurring",
          confidence: 0.8,
          salience: 0.8,
          evidence: "The image shows an outing.",
          source_refs: ["image:0"],
          prior_support_keys: [],
        },
      ]),
      {
        memoryId: "memory-image-only",
        sources: [imageSource],
        existingConcepts: [],
      },
    );

    expect(extraction.nodes.map((node) => node.category)).toEqual([
      "experience",
      "place",
    ]);
    expect(extraction.nodes[1].certainty).toBe("fact");
    expect(extraction.edges).toContainEqual(
      expect.objectContaining({
        fromLocalKey: "moment",
        toLocalKey: "waterfront",
        relation: "happened_at",
      }),
    );
  });

  it("allows a recurring pattern only with authored current evidence and valid prior support", () => {
    const contextSource: MemorySourceDescriptor = {
      ref: "context:0",
      type: "image_context",
      text: "Another quiet place I stayed in for hours.",
      attachmentIndex: 0,
    };
    const pattern = {
      local_key: "quiet-pattern",
      existing_key: "",
      category: "pattern",
      subtype: "recurring_preference",
      label: "Lingering in quiet places",
      description: "Quiet places repeatedly invite the user to stay longer.",
      basis: "recurring",
      confidence: 0.92,
      salience: 0.82,
      evidence: "The current context and an earlier memory both describe lingering.",
      source_refs: ["context:0"],
      prior_support_keys: ["place:quiet-cafe:first:2"],
    };
    const extraction = prepareMemoryExtraction(
      rawExtraction([momentNode(["context:0"]), pattern]),
      {
        memoryId: "memory-second",
        sources: [contextSource],
        existingConcepts: [
          {
            key: "place:quiet-cafe:first:2",
            category: "place",
            label: "Quiet cafe",
            description: "A cafe where the user stayed for hours.",
            occurrenceCount: 1,
          },
        ],
      },
    );

    const preparedPattern = extraction.nodes.find(
      (node) => node.category === "pattern",
    );
    expect(preparedPattern).toEqual(
      expect.objectContaining({
        certainty: "hypothesis",
        confidence: 0.86,
        priorSupportKeys: ["place:quiet-cafe:first:2"],
      }),
    );
  });

  it("reuses an existing identity only through an exact validated key", () => {
    const extraction = prepareMemoryExtraction(
      rawExtraction([
        momentNode(),
        {
          local_key: "alex-known",
          existing_key: "people:alex:first:2",
          category: "people",
          subtype: "friend",
          label: "Alex",
          description: "Alex joined the walk.",
          basis: "explicit",
          confidence: 0.97,
          salience: 0.8,
          evidence: "Alex and I walked.",
          source_refs: ["text:main"],
          prior_support_keys: [],
        },
        {
          local_key: "alex-ambiguous",
          existing_key: "people:alex:first:2",
          category: "place",
          subtype: "cafe",
          label: "Alex",
          description: "A cafe called Alex.",
          basis: "explicit",
          confidence: 0.9,
          salience: 0.5,
          evidence: "The cafe sign said Alex.",
          source_refs: ["text:main"],
          prior_support_keys: [],
        },
      ]),
      {
        memoryId: "memory-next",
        sources: [textSource],
        existingConcepts: [
          {
            key: "people:alex:first:2",
            category: "people",
            label: "Alex",
            description: "A person from an earlier memory.",
            occurrenceCount: 1,
          },
        ],
      },
    );

    expect(
      extraction.nodes.find((node) => node.localKey === "alex-known")
        ?.canonicalKey,
    ).toBe("people:alex:first:2");
    expect(
      extraction.nodes.find((node) => node.localKey === "alex-ambiguous")
        ?.canonicalKey,
    ).toMatch(/^place:alex:memory-next:/);
  });

  it("collapses immutable mentions and remaps their relationships without self loops", () => {
    const nodes = [
      {
        id: "memory-one",
        memory_id: "m1",
        category: "experience",
        source_type: "memory",
        canonical_key: "memory:m1",
        label: "First",
        confidence: 1,
        salience: 1,
        created_at: 1,
      },
      {
        id: "alex-one",
        memory_id: "m1",
        category: "people",
        source_type: "memory",
        canonical_key: "people:alex:stable",
        label: "Alex",
        description: "Alex joined the walk.",
        confidence: 0.8,
        salience: 0.7,
        created_at: 2,
      },
      {
        id: "alex-two",
        memory_id: "m2",
        category: "people",
        source_type: "memory",
        canonical_key: "people:alex:stable",
        label: "Alex",
        description: "Alex stayed for dinner.",
        confidence: 0.95,
        salience: 0.8,
        created_at: 4,
      },
    ];
    const edges = [
      {
        id: "edge-one",
        memory_id: "m1",
        from_node_id: "memory-one",
        to_node_id: "alex-one",
        relation: "shared_with",
        strength: 0.8,
        created_at: 3,
      },
      {
        id: "edge-self-after-collapse",
        memory_id: "m2",
        from_node_id: "alex-one",
        to_node_id: "alex-two",
        relation: "reinforces",
        strength: 0.7,
        created_at: 5,
      },
    ];

    const collapsed = collapseMemoryGraphRows(nodes, edges);
    const alex = collapsed.nodes.find((node) => node.label === "Alex");

    expect(collapsed.nodes).toHaveLength(2);
    expect(alex).toEqual(
      expect.objectContaining({
        id: "alex-one",
        description: "Alex stayed for dinner.",
        occurrence_count: 2,
      }),
    );
    expect(collapsed.aliases.get("alex-two")).toBe("alex-one");
    expect(collapsed.edges).toHaveLength(1);
    expect(collapsed.edges[0]).toEqual(
      expect.objectContaining({
        from_node_id: "memory-one",
        to_node_id: "alex-one",
      }),
    );
  });

  it("maps image attachments and per-image context explicitly in the prompt", () => {
    const prompt = buildMemoryExtractionPrompt({
      text: "",
      sources: [
        { ref: "image:0", type: "image", attachmentIndex: 0 },
        {
          ref: "context:0",
          type: "image_context",
          text: "That is my cousin Mina.",
          attachmentIndex: 0,
        },
      ],
      existingConcepts: [],
      previousMemorySummaries: [],
    });

    expect(prompt).toContain("attachment 1 = [image:0]");
    expect(prompt).toContain("[context:0] That is my cousin Mina.");
    expect(prompt).toContain("Pixels establish only what is visibly present.");
    expect(prompt).toContain(
      "Every identifiable individual gets a separate people node.",
    );
    expect(prompt).toContain(
      "Never combine multiple people into one people node.",
    );
  });
});

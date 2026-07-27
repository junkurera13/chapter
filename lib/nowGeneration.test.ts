import { describe, expect, it } from "vitest";

import type { ExperienceGraphRecord } from "./backendTypes";
import {
  buildBriefPrompt,
  buildComposePrompt,
  buildGraphDigest,
} from "./nowGeneration";
import {
  NOW_RESEARCH_OUTPUT_SCHEMA,
  nowBriefSchema,
  nowResearchFindingSchema,
} from "./nowChapterSchema";

function sampleGraph(): ExperienceGraphRecord {
  return {
    memoryCount: 1,
    nodes: [
      {
        id: "n-halmoni",
        sourceType: "memory",
        category: "people",
        subtype: "family",
        kind: "person",
        label: "Halmoni",
        description: "Grandmother",
        certainty: "fact",
        confidence: 0.95,
        salience: 0.9,
        evidence: "stated",
        createdAt: 1,
      },
      {
        id: "n-skewers",
        sourceType: "memory",
        category: "activity",
        subtype: "meal",
        kind: "activity",
        label: "Eating Meat Skewers",
        description: "Charcoal skewers with friends",
        certainty: "fact",
        confidence: 0.9,
        salience: 0.8,
        evidence: "stated",
        createdAt: 2,
      },
    ],
    edges: [
      {
        id: "e1",
        memoryId: "m1",
        fromNodeId: "n-skewers",
        toNodeId: "n-halmoni",
        relation: "shared_with",
        polarity: "positive",
        familiarity: "familiar",
        strength: 0.9,
        certainty: "fact",
        createdAt: 2,
      },
    ],
  };
}

describe("buildGraphDigest", () => {
  it("keeps the most salient nodes and their edges", () => {
    const digest = buildGraphDigest(sampleGraph(), 60);
    expect(digest.nodes.map((node) => node.id)).toEqual([
      "n-halmoni",
      "n-skewers",
    ]);
    expect(digest.edges).toHaveLength(1);
    expect(digest.nodes[0]).not.toHaveProperty("description");
  });

  it("drops edges whose endpoints fell out of the digest", () => {
    const digest = buildGraphDigest(sampleGraph(), 1);
    expect(digest.nodes).toHaveLength(1);
    expect(digest.edges).toHaveLength(0);
  });
});

describe("buildBriefPrompt", () => {
  it("carries the one-stretch rule, city, exclusions, and decline feedback", () => {
    const prompt = buildBriefPrompt({
      graph: sampleGraph(),
      homeCity: "Seoul",
      avoidVenues: ["Old Grill House"],
      declineReason: "too far away",
    });

    expect(prompt).toContain("EXACTLY ONE dimension");
    expect(prompt).toContain("Seoul");
    expect(prompt).toContain("Old Grill House");
    expect(prompt).toContain("too far away");
    expect(prompt).toContain("top-10 listicles");
    expect(prompt).toContain("still operates");
  });
});

describe("now schemas", () => {
  it("accepts a well-formed brief and rejects a stretch-less one", () => {
    const valid = nowBriefSchema.safeParse({
      threadTitle: "Charcoal nights",
      anchors: [
        { nodeId: "n-skewers", label: "Eating Meat Skewers", category: "activity" },
      ],
      stretch: {
        dimension: "place",
        description: "A charcoal grill in a neighbourhood they have never mentioned.",
      },
      researchObjective:
        "Find one small, family-run charcoal skewer restaurant in Seoul, at least 15 years old, outside Wangsimni, with recent evidence it still operates, open Saturday evenings.",
    });
    expect(valid.success).toBe(true);

    const invalid = nowBriefSchema.safeParse({
      threadTitle: "Charcoal nights",
      anchors: [],
      stretch: { dimension: "everything", description: "all new" },
      researchObjective: "short",
    });
    expect(invalid.success).toBe(false);
  });

  it("research schema demands the anti-obvious fields", () => {
    expect(NOW_RESEARCH_OUTPUT_SCHEMA.required).toContain("why_uncommon");
    expect(
      NOW_RESEARCH_OUTPUT_SCHEMA.properties.venue_name.description,
    ).toMatch(/never a chain/i);
  });

  it("parses a realistic research finding", () => {
    const finding = nowResearchFindingSchema.safeParse({
      venue_name: "Halmae Yeontan Gui",
      venue_area: "Mangwon-dong, Seoul",
      why_uncommon: "Run by one grandmother since 1994; eight seats.",
      best_time: "Saturday from 6pm; closes when the charcoal runs out.",
      address: null,
      price_note: null,
      still_operating_evidence: "Naver review from last month.",
    });
    expect(finding.success).toBe(true);
  });
});

describe("buildComposePrompt", () => {
  it("passes anchors verbatim and forbids invented details", () => {
    const brief = nowBriefSchema.parse({
      threadTitle: "Charcoal nights",
      anchors: [
        { nodeId: "n-skewers", label: "Eating Meat Skewers", category: "activity" },
        { nodeId: "n-halmoni", label: "Halmoni", category: "people" },
      ],
      stretch: {
        dimension: "place",
        description: "A charcoal grill in a neighbourhood they have never mentioned.",
      },
      researchObjective:
        "Find one small, family-run charcoal skewer restaurant in Seoul, at least 15 years old, outside Wangsimni, with recent evidence it still operates, open Saturday evenings.",
    });
    const prompt = buildComposePrompt({
      brief,
      finding: {
        venue_name: "Halmae Yeontan Gui",
        venue_area: "Mangwon-dong, Seoul",
        why_uncommon: "Run by one grandmother since 1994.",
        best_time: "Saturday evenings",
      },
      homeCity: "Seoul",
    });

    expect(prompt).toContain('"Eating Meat Skewers","Halmoni"');
    expect(prompt).toContain("VERBATIM");
    expect(prompt).toContain("Do not invent details");
    expect(prompt).toContain("Halmae Yeontan Gui");
  });
});

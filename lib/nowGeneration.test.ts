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

  it("hands the researcher the day and the hours that were set aside", () => {
    const prompt = buildBriefPrompt({
      graph: sampleGraph(),
      homeCity: "Seoul",
      scheduledFor: "2026-08-08",
      timeWindows: ["evening", "night"],
    });

    expect(prompt).toContain("Saturday 2026-08-08");
    expect(prompt).toContain("evening (17:00–21:00)");
    expect(prompt).toContain("night (21:00–late)");
    expect(prompt).toContain("find a different one rather than moving the day");
    // The schedule replaces the model's own guess at a time, rather than
    // arriving alongside it as a second opinion.
    expect(prompt).not.toContain("state the day/time window that suits");
  });

  it("leaves the time of day to the brief when no day was set aside", () => {
    const prompt = buildBriefPrompt({ graph: sampleGraph(), homeCity: "Seoul" });
    expect(prompt).toContain("state the day/time window that suits");
    expect(prompt).not.toContain("This is fixed");
  });

  it("turns a walkable reach into a neighbourhood-scale search", () => {
    const prompt = buildBriefPrompt({
      graph: sampleGraph(),
      homeCity: "Bangbae-dong, Seoul",
      reach: "walk",
    });

    expect(prompt).toContain("a fifteen minute walk of Bangbae-dong, Seoul");
    expect(prompt).toContain("neighbourhood-scale search");
    expect(prompt).toContain("wrong answer");
  });

  it("makes the widest reach leave the city rather than loosen it", () => {
    const prompt = buildBriefPrompt({
      graph: sampleGraph(),
      homeCity: "Seoul",
      reach: "beyond",
    });

    // The whole point of the far stop: without this it just returns Seoul
    // again with a wider bound on it.
    expect(prompt).toContain("must NOT be in Seoul itself");
    expect(prompt).toContain("two hours by train, bus or car");
  });

  it("falls back to the middle reach when none was chosen", () => {
    const prompt = buildBriefPrompt({ graph: sampleGraph(), homeCity: "Seoul" });
    expect(prompt).toContain("about thirty minutes");
    expect(prompt).not.toContain("must NOT be in Seoul itself");
  });
});

describe("buildComposePrompt", () => {
  const finding = {
    venue_name: "Mangwon Charcoal House",
    venue_area: "Mangwon-dong, Seoul",
    why_uncommon: "Run by one family since 1978, no English signage.",
    best_time: "Saturday evening, from 18:00",
  };
  const brief = {
    threadTitle: "Charcoal nights",
    anchors: [
      { nodeId: "n-halmoni", label: "Halmoni", category: "people" },
    ],
    stretch: {
      dimension: "place" as const,
      description: "A grill in a neighbourhood they have never mentioned.",
    },
    researchObjective: "x".repeat(120),
  };

  it("writes a settled day as settled, never as a suggestion", () => {
    const prompt = buildComposePrompt({
      brief,
      finding,
      homeCity: "Seoul",
      scheduledFor: "2026-08-08",
      timeWindows: ["evening"],
    });

    expect(prompt).toContain("THE DAY: Saturday 2026-08-08");
    expect(prompt).toContain("evening");
    expect(prompt).toContain("state it rather than asking about it");
  });

  it("says nothing about a day when there isn’t one", () => {
    const prompt = buildComposePrompt({ brief, finding, homeCity: "Seoul" });
    expect(prompt).not.toContain("THE DAY:");
    expect(prompt).not.toContain("state it rather than asking about it");
  });

  /*
   * The regression this whole shape exists to prevent.
   *
   * Compose used to be handed the anchor labels and told to use every one of
   * them verbatim. Given a graph node labelled "Halmoni", that instruction
   * required the model to work somebody's grandmother into a sentence about a
   * restaurant, and it duly wrote one that claimed she used to take them there.
   * The memories belong on the card as its sources, which are checkable. They
   * have no business inside a sentence about a venue.
   */
  it("never hands a person's memories to the sentence about a venue", () => {
    const prompt = buildComposePrompt({
      brief,
      finding,
      homeCity: "Seoul",
      scheduledFor: "2026-08-08",
    });

    expect(prompt).not.toContain("Halmoni");
    expect(prompt).not.toContain("ANCHOR");
    expect(prompt).toContain("Say NOTHING about the person");
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
  it("carries the venue verbatim and nothing that could be embroidered", () => {
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

    expect(prompt).toContain("VERBATIM");
    expect(prompt).toContain("Halmae Yeontan Gui");
    // The stretch steers the choice and is explicitly not for saying out loud.
    expect(prompt).toContain("never say it");
    expect(prompt).not.toContain("Eating Meat Skewers");
  });
});

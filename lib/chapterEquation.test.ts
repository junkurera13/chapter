import { describe, expect, it } from "vitest";

import {
  CHAPTER_COMPANIES,
  CHAPTER_DIMENSIONS,
  auditChapterShape,
  isLegalChapterShape,
  legalChapterShapes,
} from "./chapterEquation";
import { EXPERIENCE_NODE_CATEGORIES } from "./experienceOntology";

describe("dimensions", () => {
  it("are all real memory graph node categories", () => {
    for (const dimension of CHAPTER_DIMENSIONS) {
      expect(EXPERIENCE_NODE_CATEGORIES).toContain(dimension);
    }
  });

  it("do not include time, which is a property rather than a memory", () => {
    expect(CHAPTER_DIMENSIONS).not.toContain("time");
  });
});

describe("the one stretch", () => {
  it("accepts the default two-layer shape", () => {
    expect(
      isLegalChapterShape({
        company: "self",
        anchor: "activity",
        twist: "place",
      }),
    ).toBe(true);
  });

  it("accepts a three-layer shape when the third dimension is unused", () => {
    expect(
      isLegalChapterShape({
        company: "self",
        anchor: "activity",
        twist: "place",
        context: "interest",
      }),
    ).toBe(true);
  });

  it("rejects a repeated dimension", () => {
    const issues = auditChapterShape({
      company: "self",
      anchor: "place",
      twist: "place",
    });
    expect(issues.map((issue) => issue.code)).toContain("DIMENSION_REPEATED");
  });

  it("cannot express a four-layer chapter at all", () => {
    // Not a rule that rejects: anchor plus twist plus context is three by
    // construction, so no legal shape ever spends every dimension.
    for (const company of CHAPTER_COMPANIES) {
      for (const shape of legalChapterShapes(company)) {
        const used = new Set(
          [shape.anchor, shape.twist, shape.context].filter(Boolean),
        );
        expect(used.size).toBeLessThan(CHAPTER_DIMENSIONS.length);
      }
    }
  });
});

describe("cold start", () => {
  it("rejects a missing anchor by default", () => {
    const issues = auditChapterShape({ company: "self", twist: "place" });
    expect(issues.map((issue) => issue.code)).toContain("ANCHOR_MISSING");
  });

  it("allows a first chapter built from the world to have no anchor", () => {
    const issues = auditChapterShape(
      { company: "self", twist: "place" },
      { coldStart: true },
    );
    expect(issues).toHaveLength(0);
  });
});

describe("company decides what people may do", () => {
  it("keeps people out of a solo chapter entirely", () => {
    const issues = auditChapterShape({
      company: "self",
      anchor: "activity",
      twist: "people",
    });
    expect(issues.map((issue) => issue.code)).toContain("PEOPLE_UNUSED");
  });

  it("anchors on the person you already know", () => {
    expect(
      isLegalChapterShape({
        company: "known-person",
        anchor: "people",
        twist: "place",
      }),
    ).toBe(true);
  });

  it("rejects a known-person chapter that anchors somewhere else", () => {
    const issues = auditChapterShape({
      company: "known-person",
      anchor: "place",
      twist: "activity",
    });
    expect(issues.map((issue) => issue.code)).toContain("PEOPLE_MUST_ANCHOR");
  });

  it("makes a new person the primary stretch, never the supporting detail", () => {
    const issues = auditChapterShape({
      company: "new-person",
      anchor: "interest",
      twist: "place",
      context: "people",
    });
    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain("PEOPLE_MUST_TWIST");
    expect(codes).toContain("PEOPLE_NOT_CONTEXT");
  });

  it("accepts strangers as the twist over a familiar interest", () => {
    expect(
      isLegalChapterShape({
        company: "small-group",
        anchor: "interest",
        twist: "people",
        context: "place",
      }),
    ).toBe(true);
  });
});

describe("the shape space", () => {
  const counts = Object.fromEntries(
    CHAPTER_COMPANIES.map((company) => [
      company,
      legalChapterShapes(company).length,
    ]),
  );

  it("matches the counts documented in docs/chapter-equation.md", () => {
    expect(counts).toEqual({
      self: 12,
      "known-person": 9,
      "new-person": 9,
      "small-group": 9,
    });
  });

  it("is thirty distinct shapes across the three modes", () => {
    // known-person and new-person/small-group differ, but small-group repeats
    // new-person's space, so the documented total counts it once.
    expect(counts.self + counts["known-person"] + counts["new-person"]).toBe(
      30,
    );
  });

  it("splits each mode into two-layer and three-layer shapes", () => {
    for (const company of CHAPTER_COMPANIES) {
      const shapes = legalChapterShapes(company);
      const twoLayer = shapes.filter((shape) => !shape.context);
      const threeLayer = shapes.filter((shape) => shape.context);
      expect(twoLayer.length).toBe(company === "self" ? 6 : 3);
      expect(threeLayer.length).toBe(6);
    }
  });
});

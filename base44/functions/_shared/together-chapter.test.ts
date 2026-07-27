import { describe, expect, it } from "vitest";

import {
  anchorsFor,
  roleFor,
  togetherChapterRecord,
  visibleTo,
} from "../../shared/together-chapter";

const brief = {
  threadTitle: "Two wheels, one coast",
  anchors: [
    {
      label: "Cycling",
      category: "activity",
      initiatorNodeId: "i-cycling",
      partnerNodeId: "p-cycling",
    },
    { label: "Pottery", category: "activity", partnerNodeId: "p-pottery" },
    { label: "Coffee", category: "interest", initiatorNodeId: "i-coffee" },
  ],
  stretch: { dimension: "place", description: "a coast road neither has ridden" },
  researchObjective: "Find one uncommon coastal ride near Fukuoka…",
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "chapter-1",
    initiator_user_id: "user-a",
    partner_user_id: "user-b",
    connection_id: "conn-1",
    status: "proposed",
    brief_json: JSON.stringify(brief),
    content_json: JSON.stringify({ title: "A ride out east" }),
    evidence_json: JSON.stringify([{ url: "https://example.com" }]),
    proposed_for: "2026-08-01",
    created_at: 1,
    initiator_lived: false,
    partner_lived: false,
    ...overrides,
  };
}

describe("roleFor", () => {
  it("places each participant, and nobody else", () => {
    expect(roleFor(row(), "user-a")).toBe("initiator");
    expect(roleFor(row(), "user-b")).toBe("partner");
    expect(roleFor(row(), "user-c")).toBeUndefined();
  });
});

describe("visibleTo", () => {
  it("keeps a draft with the initiator until they send it", () => {
    const draft = row({ status: "draft" });
    expect(visibleTo(draft, "user-a")).toBe(true);
    expect(visibleTo(draft, "user-b")).toBe(false);
  });

  it("shows a sent chapter to both", () => {
    expect(visibleTo(row(), "user-a")).toBe(true);
    expect(visibleTo(row(), "user-b")).toBe(true);
  });

  it("shows nothing to anyone outside the pair", () => {
    expect(visibleTo(row(), "user-c")).toBe(false);
  });
});

describe("anchorsFor", () => {
  it("gives the initiator only their own node ids", () => {
    expect(anchorsFor(brief, "initiator")).toEqual([
      { label: "Cycling", category: "activity", nodeId: "i-cycling" },
      { label: "Pottery", category: "activity" },
      { label: "Coffee", category: "interest", nodeId: "i-coffee" },
    ]);
  });

  it("gives the partner only theirs", () => {
    expect(anchorsFor(brief, "partner")).toEqual([
      { label: "Cycling", category: "activity", nodeId: "p-cycling" },
      { label: "Pottery", category: "activity", nodeId: "p-pottery" },
      { label: "Coffee", category: "interest" },
    ]);
  });
});

describe("togetherChapterRecord", () => {
  it("never ships one person's node ids to the other", () => {
    const forPartner = JSON.stringify(
      togetherChapterRecord(row(), "user-b", "Jun"),
    );
    expect(forPartner).not.toContain("i-cycling");
    expect(forPartner).not.toContain("i-coffee");

    const forInitiator = JSON.stringify(
      togetherChapterRecord(row(), "user-a", "Daniel"),
    );
    expect(forInitiator).not.toContain("p-cycling");
    expect(forInitiator).not.toContain("p-pottery");
  });

  it("never ships the research objective to either side", () => {
    for (const viewer of ["user-a", "user-b"]) {
      const record = JSON.stringify(
        togetherChapterRecord(row(), viewer, "Someone"),
      );
      expect(record).not.toContain("researchObjective");
      expect(record).not.toContain("uncommon coastal ride");
    }
  });

  it("reads lived flags from whichever side is looking", () => {
    const half = row({ status: "accepted", initiator_lived: true });
    expect(togetherChapterRecord(half, "user-a", "Daniel")).toMatchObject({
      youLived: true,
      theyLived: false,
    });
    expect(togetherChapterRecord(half, "user-b", "Jun")).toMatchObject({
      youLived: false,
      theyLived: true,
    });
  });

  it("names who declined, in terms of who is asking", () => {
    const declined = row({
      status: "declined",
      declined_by_user_id: "user-b",
      decline_reason: "away that weekend",
    });
    expect(togetherChapterRecord(declined, "user-b", "Jun").declinedByRole)
      .toBe("partner");
    expect(togetherChapterRecord(declined, "user-a", "Daniel").declinedByRole)
      .toBe("partner");
  });

  it("survives a chapter whose research never produced a brief", () => {
    const bare = row({ brief_json: "", content_json: "", evidence_json: "" });
    const record = togetherChapterRecord(bare, "user-a", "Daniel");
    expect(record.brief).toBeUndefined();
    expect(record.content).toBeUndefined();
    expect(record.evidence).toEqual([]);
  });
});

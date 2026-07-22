import { describe, expect, it } from "vitest";

import {
  buildMapSearchUrl,
  validateQuestPayload,
  type QuestPayload,
} from "./quest";

describe("validateQuestPayload", () => {
  it("accepts a complete Sidequest payload with exactly three stops", () => {
    const payload: QuestPayload = {
      title: "Operation Midnight Dumpling",
      brief: "Enough rotting. Report to three small checkpoints.",
      stops: [
        {
          name: "Checkpoint A",
          description: "Acquire dumplings.",
          mapSearch: "dumplings near Hongdae",
          estimatedCost: "₩8,000",
        },
        {
          name: "Checkpoint B",
          description: "Walk somewhere suspiciously scenic.",
          mapSearch: "Hongdae park",
          estimatedCost: "Free",
        },
        {
          name: "Checkpoint C",
          description: "Debrief with dessert.",
          mapSearch: "bingsu near Hongdae",
          estimatedCost: "₩12,000",
        },
      ],
      budget: "About ₩20,000",
      inviteText: "I have received a mission. Backup requested.",
      backup: "If the weather defects, switch to an indoor cafe crawl.",
    };

    expect(validateQuestPayload(payload)).toEqual(payload);
  });

  it("rejects payloads that do not include exactly three stops", () => {
    expect(() =>
      validateQuestPayload({
        title: "Too Short",
        brief: "Nope.",
        stops: [],
        budget: "Free",
        inviteText: "Join?",
        backup: "Go home.",
      }),
    ).toThrow("Quest must include exactly three stops.");
  });
});

describe("buildMapSearchUrl", () => {
  it("builds a Google Maps search URL from a plain query", () => {
    expect(buildMapSearchUrl("late night tteokbokki Seoul")).toBe(
      "https://www.google.com/maps/search/?api=1&query=late%20night%20tteokbokki%20Seoul",
    );
  });
});

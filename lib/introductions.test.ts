import { beforeEach, describe, expect, it, vi } from "vitest";

const generateStructured = vi.fn();

vi.mock("./nowGeneration", async () => {
  const actual = await vi.importActual<typeof import("./nowGeneration")>(
    "./nowGeneration",
  );
  return { ...actual, generateStructured };
});

const {
  buildIntroductionPrompt,
  fallbackIntroductionLine,
  writeIntroductionLines,
} = await import("./introductions");

const thread = {
  otherUserId: "user-b",
  weight: 2.4,
  anchors: [
    { label: "cycling", category: "activity" },
    { label: "Mojiko", category: "place" },
  ],
};

beforeEach(() => {
  generateStructured.mockReset();
});

describe("buildIntroductionPrompt", () => {
  it("forbids inventing a name or a gender for someone unnamed", () => {
    const prompt = buildIntroductionPrompt([thread], "Fukuoka");
    expect(prompt).toContain("NO NAME");
    expect(prompt).toContain("never guess a gender");
  });

  it("never sends the other person's id to the model", () => {
    expect(buildIntroductionPrompt([thread], "Fukuoka")).not.toContain("user-b");
  });

  it("allows the city only when there is one", () => {
    expect(buildIntroductionPrompt([thread], "Fukuoka")).toContain("Fukuoka");
    expect(buildIntroductionPrompt([thread], "")).not.toContain(
      "The city both people live in",
    );
  });
});

describe("fallbackIntroductionLine", () => {
  it("is plain, true, and names nobody", () => {
    expect(fallbackIntroductionLine(thread, "Fukuoka")).toBe(
      "Someone in Fukuoka also knows cycling and Mojiko.",
    );
  });

  it("drops the city rather than inventing one", () => {
    expect(fallbackIntroductionLine(thread, "")).toBe(
      "Someone also knows cycling and Mojiko.",
    );
  });
});

describe("writeIntroductionLines", () => {
  it("asks for nothing when there is nothing to say", async () => {
    const written = await writeIntroductionLines({
      threads: [],
      city: "Fukuoka",
      requestId: "req-1",
    });

    expect(written).toEqual([]);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("keeps only the anchors the sentence actually names", async () => {
    generateStructured.mockResolvedValue({
      lines: [{ index: 0, line: "Someone here knows cycling too." }],
    });

    const [written] = await writeIntroductionLines({
      threads: [thread],
      city: "Fukuoka",
      requestId: "req-2",
    });

    expect(written.line).toBe("Someone here knows cycling too.");
    expect(written.anchors.map((anchor) => anchor.label)).toEqual(["cycling"]);
  });

  it("falls back to something true when the model cannot be reached", async () => {
    generateStructured.mockRejectedValue(new Error("gateway down"));

    const [written] = await writeIntroductionLines({
      threads: [thread],
      city: "Fukuoka",
      requestId: "req-3",
    });

    expect(written.line).toBe("Someone in Fukuoka also knows cycling and Mojiko.");
    expect(written.anchors).toHaveLength(2);
  });

  it("falls back rather than shipping a line too short to mean anything", async () => {
    generateStructured.mockResolvedValue({ lines: [{ index: 0, line: "Hm." }] });

    const [written] = await writeIntroductionLines({
      threads: [thread],
      city: "Fukuoka",
      requestId: "req-4",
    });

    expect(written.line).toContain("Someone in Fukuoka");
  });

  it("carries the other person's id through without ever writing it down", async () => {
    generateStructured.mockResolvedValue({
      lines: [{ index: 0, line: "Someone here knows cycling and Mojiko too." }],
    });

    const [written] = await writeIntroductionLines({
      threads: [thread],
      city: "Fukuoka",
      requestId: "req-5",
    });

    expect(written.otherUserId).toBe("user-b");
    expect(written.line).not.toContain("user-b");
  });
});

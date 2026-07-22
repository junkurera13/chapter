import { describe, expect, it } from "vitest";
import { formatNodeLabel } from "./displayText";

describe("formatNodeLabel", () => {
  it("capitalizes meaningful words and quiets connecting words", () => {
    expect(formatNodeLabel("the familiar, made new")).toBe(
      "The Familiar, Made New",
    );
    expect(formatNodeLabel("an island near Fukuoka")).toBe(
      "An Island Near Fukuoka",
    );
    expect(formatNodeLabel("joy in movement")).toBe("Joy in Movement");
  });

  it("capitalizes a short word at the beginning or end", () => {
    expect(formatNodeLabel("you")).toBe("You");
    expect(formatNodeLabel("what it is")).toBe("What It Is");
  });

  it("preserves acronyms and intentional product casing", () => {
    expect(formatNodeLabel("EDM with iPhone photography")).toBe(
      "EDM with iPhone Photography",
    );
  });
});

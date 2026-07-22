import { describe, expect, it } from "vitest";

import { safeBase44AuthReturnPath } from "./base44AuthReturn";

describe("safeBase44AuthReturnPath", () => {
  it("keeps a connection invitation on this app", () => {
    const path = `/invite/${"a".repeat(43)}`;
    expect(safeBase44AuthReturnPath(path)).toBe(
      path,
    );
  });

  it.each([
    "https://attacker.example/invite/token",
    "//attacker.example/invite/token",
    "/app",
    "/invite\\attacker.example",
    "/invite/short",
    `/invite/${"a".repeat(43)}/../app`,
    undefined,
  ])("rejects unsafe or unrelated return paths", (path) => {
    expect(safeBase44AuthReturnPath(path)).toBeNull();
  });
});

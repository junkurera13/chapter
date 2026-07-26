import { describe, expect, it } from "vitest";

import {
  safeBase44AuthReturnOrigin,
  safeBase44AuthReturnPath,
} from "./base44AuthReturn";

describe("safeBase44AuthReturnOrigin", () => {
  it.each([
    ["http://localhost:3000/api/apps/auth/final-callback", "http://localhost:3000"],
    ["http://127.0.0.1:3000/api/apps/auth/final-callback", "http://127.0.0.1:3000"],
  ])("keeps a trusted local callback on its origin", (requestUrl, origin) => {
    expect(safeBase44AuthReturnOrigin(requestUrl)).toBe(origin);
  });

  it.each([
    "https://usechapter.vercel.app/api/apps/auth/final-callback",
    "https://sidequest-b44.vercel.app/api/apps/auth/final-callback",
    "http://localhost:4000/api/apps/auth/final-callback",
    "http://localhost.attacker.example:3000/api/apps/auth/final-callback",
    "not a url",
  ])("canonicalizes every other callback to production", (requestUrl) => {
    expect(safeBase44AuthReturnOrigin(requestUrl)).toBe(
      "https://usechapter.vercel.app",
    );
  });
});

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

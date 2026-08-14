import { describe, expect, it } from "vitest";

import {
  createChapterAccessToken,
  verifyChapterAccessPassword,
  verifyChapterAccessToken,
} from "./chapter-access";

describe("Chapter access gate", () => {
  it("accepts only the configured shared password", async () => {
    await expect(
      verifyChapterAccessPassword("utility", "utility"),
    ).resolves.toBe(true);
    await expect(
      verifyChapterAccessPassword("Utility", "utility"),
    ).resolves.toBe(false);
    await expect(verifyChapterAccessPassword("", "utility")).resolves.toBe(
      false,
    );
  });

  it("accepts only an untampered token signed by the same secret", async () => {
    const token = await createChapterAccessToken("test-signing-secret");

    await expect(
      verifyChapterAccessToken(token, "test-signing-secret"),
    ).resolves.toBe(true);
    await expect(
      verifyChapterAccessToken(`${token}0`, "test-signing-secret"),
    ).resolves.toBe(false);
    await expect(
      verifyChapterAccessToken(token, "different-secret"),
    ).resolves.toBe(false);
  });
});

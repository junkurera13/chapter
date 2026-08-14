/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Chapter waitlist", () => {
  test("stores a normalized email only once", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.waitlist.join, { email: "  Hello@Example.com " });
    await t.mutation(api.waitlist.join, { email: "hello@example.com" });

    const entries = await t.run((ctx) =>
      ctx.db.query("waitlistEntries").take(10),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      email: "Hello@Example.com",
      normalizedEmail: "hello@example.com",
      status: "waiting",
    });
  });

  test("rejects malformed email addresses", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.waitlist.join, { email: "not-an-email" }),
    ).rejects.toThrow("Enter a valid email address.");
  });
});

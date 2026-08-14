import { v } from "convex/values";

import { mutation } from "./_generated/server";

export function normalizeWaitlistEmail(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();

  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Enter a valid email address.");
  }

  return email;
}

export const join = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeWaitlistEmail(args.email);
    const existing = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_normalized_email", (query) =>
        query.eq("normalizedEmail", normalizedEmail),
      )
      .unique();

    if (!existing) {
      const now = Date.now();
      await ctx.db.insert("waitlistEntries", {
        email: args.email.trim(),
        normalizedEmail,
        status: "waiting",
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

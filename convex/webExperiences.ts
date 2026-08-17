import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  chapterExperienceValidator,
  experienceKindValidator,
} from "./chapterValidators";
import { requireCurrentAccount } from "./lib/auth";

const experienceStatusValidator = v.union(
  v.literal("sent"),
  v.literal("saved"),
  v.literal("passed"),
  v.literal("done"),
);

function cleanRequest(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length < 1 || cleaned.length > 1_000) {
    throw new Error("Experience requests must be between 1 and 1,000 characters.");
  }
  return cleaned;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const account = await requireCurrentAccount(ctx);
    return await ctx.db
      .query("accountExperiences")
      .withIndex("by_owner_account_id_and_created_at", (queryBuilder) =>
        queryBuilder.eq("ownerAccountId", account._id),
      )
      .order("desc")
      .take(24);
  },
});

export const saveGenerated = mutation({
  args: {
    kind: experienceKindValidator,
    requestText: v.string(),
    experience: chapterExperienceValidator,
  },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    if (args.experience.kind !== args.kind) {
      throw new Error("Experience kind does not match the request.");
    }
    const now = Date.now();
    return await ctx.db.insert("accountExperiences", {
      ownerAccountId: account._id,
      kind: args.kind,
      requestText: cleanRequest(args.requestText),
      experience: args.experience,
      status: "sent",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    experienceId: v.id("accountExperiences"),
    status: experienceStatusValidator,
  },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    const experience = await ctx.db.get(args.experienceId);
    if (!experience || experience.ownerAccountId !== account._id) {
      throw new Error("Experience not found.");
    }
    await ctx.db.patch(experience._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return experience._id;
  },
});

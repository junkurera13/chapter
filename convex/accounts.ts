import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  cleanDisplayName,
  findCurrentAccount,
  normalizeName,
  requireIdentity,
} from "./lib/auth";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { account } = await findCurrentAccount(ctx);
    return account;
  },
});

export const ensureCurrent = mutation({
  args: {
    displayName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_token_identifier", (queryBuilder) =>
        queryBuilder.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const rawName =
      args.displayName ?? identity.name ?? identity.email ?? "Chapter member";
    const displayName = cleanDisplayName(rawName);
    const imageUrl = args.imageUrl ?? identity.pictureUrl;
    const now = Date.now();

    if (existing !== null) {
      const accountChanged =
        existing.displayName !== displayName || existing.imageUrl !== imageUrl;
      if (accountChanged) {
        await ctx.db.patch(existing._id, {
          displayName,
          normalizedName: normalizeName(displayName),
          imageUrl,
          updatedAt: now,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("accounts", {
      tokenIdentifier: identity.tokenIdentifier,
      displayName,
      normalizedName: normalizeName(displayName),
      imageUrl,
      createdAt: now,
      updatedAt: now,
    });
  },
});

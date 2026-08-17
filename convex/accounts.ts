import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  cleanDisplayName,
  findCurrentAccount,
  normalizeName,
  requireCurrentAccount,
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

export const saveLocation = mutation({
  args: {
    homeCity: v.string(),
    homeArea: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    const homeCity = args.homeCity.trim().replace(/\s+/g, " ");
    const homeArea = args.homeArea?.trim().replace(/\s+/g, " ") || undefined;
    if (homeCity.length < 2 || homeCity.length > 100) {
      throw new Error("City must be between 2 and 100 characters.");
    }
    if (homeArea && homeArea.length > 100) {
      throw new Error("Neighborhood must be at most 100 characters.");
    }
    await ctx.db.patch(account._id, {
      homeCity,
      homeArea,
      updatedAt: Date.now(),
    });
    return account._id;
  },
});

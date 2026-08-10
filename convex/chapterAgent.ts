import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  chapterExperienceValidator,
  feedbackVerdictValidator,
} from "./chapterValidators";

type DatabaseCtx = Pick<QueryCtx | MutationCtx, "db">;

function cleanText(value: string, maximum: number, field: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length < 1 || cleaned.length > maximum) {
    throw new Error(`${field} must be between 1 and ${maximum} characters.`);
  }
  return cleaned;
}

async function findProfile(ctx: DatabaseCtx, externalPrincipalId: string) {
  return await ctx.db
    .query("chapterProfiles")
    .withIndex("by_external_principal_id", (queryBuilder) =>
      queryBuilder.eq("externalPrincipalId", externalPrincipalId),
    )
    .unique();
}

async function requireProfile(ctx: DatabaseCtx, externalPrincipalId: string) {
  const profile = await findProfile(ctx, externalPrincipalId);
  if (!profile) throw new Error("Chapter onboarding has not started.");
  return profile;
}

export const getContext = internalQuery({
  args: {
    externalPrincipalId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await findProfile(ctx, args.externalPrincipalId);
    if (!profile) {
      return {
        onboardingStage: "needs_memory" as const,
        location: null,
        memories: [],
        recentExperiences: [],
      };
    }

    const [memories, experiences] = await Promise.all([
      ctx.db
        .query("chapterMemories")
        .withIndex("by_external_principal_id_and_created_at", (queryBuilder) =>
          queryBuilder.eq("externalPrincipalId", args.externalPrincipalId),
        )
        .order("desc")
        .take(5),
      ctx.db
        .query("chapterExperiences")
        .withIndex("by_external_principal_id_and_created_at", (queryBuilder) =>
          queryBuilder.eq("externalPrincipalId", args.externalPrincipalId),
        )
        .order("desc")
        .take(5),
    ]);

    return {
      onboardingStage: profile.onboardingStage,
      location:
        profile.homeCity === undefined
          ? null
          : {
              city: profile.homeCity,
              area: profile.homeArea ?? null,
              country: profile.homeCountry ?? null,
            },
      memories: memories.map((memory) => ({
        id: memory._id,
        text: memory.rawText,
        createdAt: memory.createdAt,
      })),
      recentExperiences: experiences.map((experience) => ({
        id: experience._id,
        kind: experience.kind,
        title: experience.experience.title,
        summary: experience.experience.summary,
        status: experience.status,
        createdAt: experience.createdAt,
      })),
    };
  },
});

export const saveMemory = internalMutation({
  args: {
    externalPrincipalId: v.string(),
    idempotencyKey: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chapterMemories")
      .withIndex("by_idempotency_key", (queryBuilder) =>
        queryBuilder.eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      if (existing.externalPrincipalId !== args.externalPrincipalId) {
        throw new Error("Memory idempotency key belongs to another profile.");
      }
      return { memoryId: existing._id, onboardingStage: "needs_location" as const };
    }

    const now = Date.now();
    const rawText = cleanText(args.text, 4_000, "Memory");
    let profile = await findProfile(ctx, args.externalPrincipalId);
    let profileId: Id<"chapterProfiles">;

    if (!profile) {
      profileId = await ctx.db.insert("chapterProfiles", {
        externalPrincipalId: args.externalPrincipalId,
        onboardingStage: "needs_location",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      profileId = profile._id;
      if (profile.onboardingStage === "needs_memory") {
        await ctx.db.patch(profile._id, {
          onboardingStage: "needs_location",
          updatedAt: now,
        });
        profile = { ...profile, onboardingStage: "needs_location" };
      }
    }

    const memoryId = await ctx.db.insert("chapterMemories", {
      profileId,
      externalPrincipalId: args.externalPrincipalId,
      rawText,
      source: "imessage",
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
    });

    return {
      memoryId,
      onboardingStage:
        profile?.onboardingStage === "complete"
          ? ("complete" as const)
          : ("needs_location" as const),
    };
  },
});

export const saveLocation = internalMutation({
  args: {
    externalPrincipalId: v.string(),
    city: v.string(),
    area: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.externalPrincipalId);
    const now = Date.now();
    const city = cleanText(args.city, 100, "City");
    const area = args.area
      ? cleanText(args.area, 100, "Neighborhood")
      : undefined;
    const country = args.country
      ? cleanText(args.country, 100, "Country")
      : undefined;

    await ctx.db.patch(profile._id, {
      onboardingStage: "complete",
      homeCity: city,
      homeArea: area,
      homeCountry: country,
      updatedAt: now,
    });

    return { onboardingStage: "complete" as const, city, area, country };
  },
});

export const saveExperience = internalMutation({
  args: {
    externalPrincipalId: v.string(),
    idempotencyKey: v.string(),
    requestText: v.string(),
    experience: chapterExperienceValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chapterExperiences")
      .withIndex("by_idempotency_key", (queryBuilder) =>
        queryBuilder.eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      if (existing.externalPrincipalId !== args.externalPrincipalId) {
        throw new Error("Experience idempotency key belongs to another profile.");
      }
      return { experienceId: existing._id, status: existing.status };
    }

    const profile = await requireProfile(ctx, args.externalPrincipalId);
    if (profile.onboardingStage !== "complete") {
      throw new Error("Finish Chapter onboarding before creating an experience.");
    }

    const now = Date.now();
    const experienceId = await ctx.db.insert("chapterExperiences", {
      profileId: profile._id,
      externalPrincipalId: args.externalPrincipalId,
      kind: args.experience.kind,
      requestText: cleanText(args.requestText, 1_000, "Experience request"),
      experience: args.experience,
      status: "sent",
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    return { experienceId, status: "sent" as const };
  },
});

export const saveFeedback = internalMutation({
  args: {
    externalPrincipalId: v.string(),
    idempotencyKey: v.string(),
    experienceId: v.optional(v.id("chapterExperiences")),
    verdict: feedbackVerdictValidator,
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chapterFeedback")
      .withIndex("by_idempotency_key", (queryBuilder) =>
        queryBuilder.eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      if (existing.externalPrincipalId !== args.externalPrincipalId) {
        throw new Error("Feedback idempotency key belongs to another profile.");
      }
      return { feedbackId: existing._id, verdict: existing.verdict };
    }

    const profile = await requireProfile(ctx, args.externalPrincipalId);
    let experience = args.experienceId
      ? await ctx.db.get("chapterExperiences", args.experienceId)
      : await ctx.db
          .query("chapterExperiences")
          .withIndex(
            "by_external_principal_id_and_created_at",
            (queryBuilder) =>
              queryBuilder.eq(
                "externalPrincipalId",
                args.externalPrincipalId,
              ),
          )
          .order("desc")
          .first();

    if (
      experience &&
      experience.externalPrincipalId !== args.externalPrincipalId
    ) {
      throw new Error("Experience does not belong to this Chapter profile.");
    }
    if (args.verdict !== "note" && !experience) {
      throw new Error("There is no recent experience to update.");
    }

    const now = Date.now();
    if (experience && args.verdict !== "note") {
      const status =
        args.verdict === "save"
          ? "saved"
          : args.verdict === "pass"
            ? "passed"
            : "done";
      await ctx.db.patch(experience._id, { status, updatedAt: now });
      experience = { ...experience, status };
    }

    const feedbackId = await ctx.db.insert("chapterFeedback", {
      profileId: profile._id,
      externalPrincipalId: args.externalPrincipalId,
      experienceId: experience?._id,
      verdict: args.verdict,
      text: args.text
        ? cleanText(args.text, 2_000, "Feedback")
        : undefined,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
    });

    return {
      feedbackId,
      experienceId: experience?._id ?? null,
      title: experience?.experience.title ?? null,
      verdict: args.verdict,
    };
  },
});

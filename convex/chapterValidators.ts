import { type Infer, v } from "convex/values";

export const experienceKindValidator = v.union(
  v.literal("andy"),
  v.literal("marco"),
);

export const chapterExperienceValidator = v.object({
  kind: experienceKindValidator,
  title: v.string(),
  summary: v.string(),
  durationMinutes: v.number(),
  stops: v.array(
    v.object({
      name: v.string(),
      address: v.string(),
      activity: v.string(),
      hours: v.string(),
      price: v.string(),
    }),
  ),
  gettingThere: v.string(),
  booking: v.optional(v.string()),
  whatToBring: v.optional(v.string()),
  whyThisFits: v.string(),
  sources: v.array(
    v.object({
      label: v.string(),
      url: v.string(),
    }),
  ),
  verifiedAt: v.string(),
});

export type ChapterExperienceValue = Infer<typeof chapterExperienceValidator>;

export const feedbackVerdictValidator = v.union(
  v.literal("save"),
  v.literal("pass"),
  v.literal("done"),
  v.literal("note"),
);

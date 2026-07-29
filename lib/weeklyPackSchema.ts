import { z } from "zod";

import {
  WEEKLY_PACK_COMPANIES,
  WEEKLY_PACK_SCALES,
  weeklyPackAnchorSchema,
} from "./weeklyPackDesign";
import { weeklyPackCompanionSchema } from "./weeklyPackSocial";

export const WEEKLY_PACK_PUBLIC_STATUSES = [
  "locked",
  "available",
  "chosen",
  "lived",
  "dismissed",
  "expired",
  "failed",
] as const;

const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const weeklyExperienceCardSchema = z.object({
  id: z.enum(WEEKLY_PACK_SCALES),
  scale: z.enum(WEEKLY_PACK_SCALES),
  company: z.enum(WEEKLY_PACK_COMPANIES),
  title: z.string().trim().min(3).max(120),
  line: z.string().trim().min(20).max(240).optional(),
  anchors: z.array(weeklyPackAnchorSchema).max(4).optional(),
  promise: z.string().trim().min(20).max(500),
  opening: z.string().trim().min(20).max(1_000),
  durationMinutes: z.object({
    min: z.number().int().min(15).max(720),
    max: z.number().int().min(15).max(720),
  }),
  place: z.object({
    name: z.string().trim().min(2).max(160),
    area: z.string().trim().min(2).max(160),
    address: z.string().trim().min(3).max(300),
  }),
  companion: weeklyPackCompanionSchema.optional(),
  steps: z.array(z.string().trim().min(8).max(500)).min(1).max(8),
  practical: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(40),
        value: z.string().trim().min(2).max(500),
      }),
    )
    .min(3)
    .max(10),
  sourceUrls: z.array(z.string().url()).max(20),
  image: z
    .object({
      url: z.string().url(),
      alt: z.string().trim().min(2).max(240),
      kind: z.enum(["generated", "photograph"]).optional(),
      credit: z.string().trim().min(2).max(240).optional(),
    })
    .nullable(),
}).superRefine((card, context) => {
  if (card.company === "self" && card.companion) {
    context.addIssue({
      code: "custom",
      path: ["companion"],
      message: "A solo experience cannot carry a companion.",
    });
  }
  if (card.company !== "self" && !card.companion) {
    context.addIssue({
      code: "custom",
      path: ["companion"],
      message: "Every social experience must show its actual person.",
    });
  }
  if (
    card.company === "new-person" &&
    card.companion?.familiarity !== "new"
  ) {
    context.addIssue({
      code: "custom",
      path: ["companion", "familiarity"],
      message: "A new-person experience must carry a new companion.",
    });
  }
  if (
    card.company === "known-person" &&
    card.companion?.familiarity !== "known"
  ) {
    context.addIssue({
      code: "custom",
      path: ["companion", "familiarity"],
      message: "A known-person experience must carry a known companion.",
    });
  }
});

export const weeklyExperiencePackSchema = z.object({
  id: z.string().trim().min(1),
  weekKey: isoDaySchema,
  status: z.enum(WEEKLY_PACK_PUBLIC_STATUSES),
  releaseAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  cards: z.array(weeklyExperienceCardSchema).length(3).optional(),
  revealedCardIds: z.array(z.enum(WEEKLY_PACK_SCALES)).max(3),
  chosenCardId: z.enum(WEEKLY_PACK_SCALES).optional(),
  scheduledFor: isoDaySchema.optional(),
  livedAt: z.number().int().positive().optional(),
});

export type WeeklyExperienceCard = z.infer<
  typeof weeklyExperienceCardSchema
>;
export type WeeklyExperiencePack = z.infer<
  typeof weeklyExperiencePackSchema
>;
export type WeeklyPackPublicStatus =
  (typeof WEEKLY_PACK_PUBLIC_STATUSES)[number];

export const WEEKLY_SCALE_LABELS = {
  small: "Small activity",
  mini: "Mini adventure",
  proper: "Proper adventure",
} as const;

export const WEEKLY_COMPANY_LABELS = {
  self: "On your own",
  "known-person": "Bring someone",
  "new-person": "Meet someone new",
  "small-group": "With a small group",
} as const;

export function formatWeeklyDuration(
  duration: WeeklyExperienceCard["durationMinutes"],
) {
  const format = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours} hr` : `${hours} hrs`;
  };
  return duration.min === duration.max
    ? format(duration.min)
    : `${format(duration.min)}–${format(duration.max)}`;
}

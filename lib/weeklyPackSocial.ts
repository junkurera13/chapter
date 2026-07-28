import { z } from "zod";

export const WEEKLY_PACK_PERSON_TOKEN = "[[PERSON]]";

export const weeklyPackCompanionSchema = z.object({
  connectionId: z.string().trim().min(1).max(160),
  userId: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(100),
  familiarity: z.enum(["new", "known"]),
});

export type WeeklyPackCompanion = z.infer<
  typeof weeklyPackCompanionSchema
>;

const ANONYMOUS_PERSON_LANGUAGE =
  /\b(someone new|a new person|a stranger|someone you (?:do not|don't|haven't|have not) (?:know|met)|someone you already know|someone you know|a friend|your friend|bring someone)\b/i;

export function containsAnonymousPersonLanguage(value: string) {
  return ANONYMOUS_PERSON_LANGUAGE.test(value);
}

export function resolveWeeklyPersonToken(
  value: string,
  companion: WeeklyPackCompanion,
) {
  return value.split(WEEKLY_PACK_PERSON_TOKEN).join(companion.name);
}

export function weeklyCompanionInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]?.toLocaleUpperCase()).join("") || "?";
}

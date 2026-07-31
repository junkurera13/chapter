export const WEEKLY_PACK_CREATOR_EMAIL = "parkjundk@gmail.com";

export function canCreateWeeklyPacks(email: unknown) {
  return typeof email === "string" &&
    email.trim().toLowerCase() === WEEKLY_PACK_CREATOR_EMAIL;
}

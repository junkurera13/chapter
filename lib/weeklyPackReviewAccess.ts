const WEEKLY_PACK_UI_REVIEWER = "parkjundk@gmail.com";

export function canReviewWeeklyPackUI(email: string | undefined) {
  return email?.trim().toLowerCase() === WEEKLY_PACK_UI_REVIEWER;
}

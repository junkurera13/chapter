import AuthGate from "./AuthGate";
import { weeklyPackReviewStateFrom } from "@/lib/weeklyPackPreview";

export default async function ChapterAppPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    joined?: string | string[];
    review?: string | string[];
  }>;
}) {
  const { view, joined, review } = await searchParams;
  const initialTab = view === "together" ? 2 : view === "now" ? 1 : 0;
  const reviewValue = Array.isArray(review) ? review[0] : review;
  return (
    <AuthGate
      initialTab={initialTab}
      justConnected={joined === "1" || (Array.isArray(joined) && joined.includes("1"))}
      initialWeeklyPackReview={weeklyPackReviewStateFrom(reviewValue)}
    />
  );
}

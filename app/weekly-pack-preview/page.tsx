import { notFound } from "next/navigation";

import { weeklyPackReviewStateFrom } from "@/lib/weeklyPackPreview";

import WeeklyPackPreviewHarness from "./WeeklyPackPreviewHarness";

export default async function WeeklyPackPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string | string[];
    creator?: string | string[];
  }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { state, creator } = await searchParams;
  const value = Array.isArray(state) ? state[0] : state;
  const creatorValue = Array.isArray(creator) ? creator[0] : creator;
  return (
    <WeeklyPackPreviewHarness
      state={weeklyPackReviewStateFrom(value) ?? "sealed"}
      showCreator={creatorValue === "1"}
    />
  );
}

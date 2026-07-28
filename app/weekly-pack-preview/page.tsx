import { notFound } from "next/navigation";

import { weeklyPackReviewStateFrom } from "@/lib/weeklyPackPreview";

import WeeklyPackPreviewHarness from "./WeeklyPackPreviewHarness";

export default async function WeeklyPackPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { state } = await searchParams;
  const value = Array.isArray(state) ? state[0] : state;
  return (
    <WeeklyPackPreviewHarness
      state={weeklyPackReviewStateFrom(value) ?? "sealed"}
    />
  );
}

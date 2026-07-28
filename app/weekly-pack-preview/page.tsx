import { notFound } from "next/navigation";

import WeeklyPackView from "@/app/app/WeeklyPackView";
import type { WeeklyPackPreviewMode } from "@/lib/weeklyPackPreview";

export default async function WeeklyPackPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { state } = await searchParams;
  const value = Array.isArray(state) ? state[0] : state;
  const previewMode: WeeklyPackPreviewMode =
    value === "locked" ? "locked" : value === "chosen" ? "chosen" : "available";
  return <WeeklyPackView previewMode={previewMode} />;
}


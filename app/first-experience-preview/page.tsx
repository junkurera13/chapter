import { notFound } from "next/navigation";

import FirstExperiencePreviewHarness from "./FirstExperiencePreviewHarness";

/**
 * Every screen this surface can be on, including the two that exist before a
 * chapter does: the wait that starts the moment somebody asks for a first
 * experience, and the ask that never landed.
 */
const PREVIEW_STATUSES = [
  "writing",
  "ask-failed",
  "researching",
  "proposed",
  "accepted",
  "lived",
  "failed",
] as const;

type PreviewStatus = (typeof PREVIEW_STATUSES)[number];

export default async function FirstExperiencePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { state } = await searchParams;
  const value = Array.isArray(state) ? state[0] : state;
  const status = PREVIEW_STATUSES.includes(value as PreviewStatus)
    ? (value as PreviewStatus)
    : "proposed";

  return <FirstExperiencePreviewHarness status={status} />;
}

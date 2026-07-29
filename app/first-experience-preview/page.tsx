import { notFound } from "next/navigation";

import FirstExperiencePreviewHarness from "./FirstExperiencePreviewHarness";

const PREVIEW_STATUSES = [
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

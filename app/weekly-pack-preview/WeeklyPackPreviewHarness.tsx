"use client";

import WeeklyPackReviewToolbar from "@/app/app/WeeklyPackReviewToolbar";
import WeeklyPackView from "@/app/app/WeeklyPackView";
import type { WeeklyPackReviewState } from "@/lib/weeklyPackPreview";

export default function WeeklyPackPreviewHarness({
  state,
  showCreator = false,
}: {
  state: WeeklyPackReviewState;
  showCreator?: boolean;
}) {
  function changeState(nextState: WeeklyPackReviewState) {
    const url = new URL(window.location.href);
    url.searchParams.set("state", nextState);
    window.location.assign(url);
  }

  return (
    <>
      <WeeklyPackView
        key={state}
        reviewState={state}
        onReviewStateChange={changeState}
        canCreateExperiences={showCreator}
      />
      <WeeklyPackReviewToolbar
        state={state}
        onChange={changeState}
        onExit={() => window.location.assign("/weekly-pack-preview")}
      />
    </>
  );
}

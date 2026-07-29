"use client";

import FirstExperienceView from "@/app/app/FirstExperienceView";
import type { NowChapterRecord } from "@/lib/nowChapterSchema";
import { useState } from "react";

export type FirstExperiencePreviewStatus =
  | "writing"
  | "ask-failed"
  | "researching"
  | "proposed"
  | "accepted"
  | "lived"
  | "failed";

/** The two states that exist before there is any chapter to preview. */
type ChapterStatus = Exclude<
  FirstExperiencePreviewStatus,
  "writing" | "ask-failed"
>;

function previewChapter(status: ChapterStatus): NowChapterRecord {
  const base: NowChapterRecord = {
    id: "preview-first-experience",
    status,
    createdAt: Date.UTC(2026, 6, 29, 0),
    brief: {
      basis: "world",
      threadTitle: "A current-world first experience",
      anchors: [],
      stretch: {
        dimension: "activity",
        description:
          "Try one unfamiliar compact action in a nearby public setting.",
      },
      researchObjective:
        "Find and verify one current public activity in Seoul that takes 30 to 90 minutes, needs no complicated booking, and has a precise arrival point.",
    },
  };

  if (status === "researching" || status === "failed") return base;
  return {
    ...base,
    scheduledFor:
      status === "accepted" || status === "lived" ? "2026-08-01" : undefined,
    content: {
      line: "How about printing one small risograph postcard at Ohu Print Studio this Saturday?",
      activity: "printing one small risograph postcard",
      when: "this Saturday",
      venueName: "Ohu Print Studio",
      venueArea: "Euljiro, Seoul",
      address: "22 Eulji-ro 18-gil, Jung-gu, Seoul",
      bestTime: "Saturday afternoon, during the open studio session",
      priceNote: "Materials cost about ₩12,000",
    },
    evidence: [],
  };
}

export default function FirstExperiencePreviewHarness({
  status,
}: {
  status: FirstExperiencePreviewStatus;
}) {
  const waiting = status === "writing" || status === "ask-failed";
  const [chapter, setChapter] = useState<NowChapterRecord | null>(() =>
    waiting ? null : previewChapter(status as ChapterStatus),
  );
  return (
    <FirstExperienceView
      chapter={chapter}
      onChapterChange={setChapter}
      askFailed={status === "ask-failed"}
      onAskAgain={() => setChapter(previewChapter("researching"))}
    />
  );
}

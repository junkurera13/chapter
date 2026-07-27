import { getAccessToken } from "@base44/sdk";

import type {
  IntroductionAnswer,
  IntroductionsState,
} from "./introductionSchema";
import {
  forgetOpened,
  OPENED_GISTS,
  OPENED_INTRODUCTIONS,
  OPENED_NOW,
  OPENED_TOGETHER,
  rememberOpened,
} from "./openedViews";
import type { TogetherChapterRecord } from "./togetherChapterSchema";
import type { TogetherGistsState } from "./togetherGistSchema";

export type TogetherState = {
  homeCity: string;
  chapters: TogetherChapterRecord[];
  avoidVenues?: string[];
};

export class TogetherRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TogetherRequestError";
  }
}

async function togetherFetch<T>(init?: {
  path?: string;
  method?: "POST";
  body?: Record<string, unknown>;
}): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new TogetherRequestError(
      "Your session expired.",
      "AUTHENTICATION_REQUIRED",
      401,
    );
  }

  const response = await fetch(`/api/together${init?.path ?? ""}`, {
    method: init?.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    value?: T;
    error?: string;
    code?: string;
  };
  if (!response.ok || payload.value === undefined) {
    throw new TogetherRequestError(
      payload.error || "Chapter couldn’t reach Together.",
      payload.code || "TOGETHER_FAILED",
      response.status,
    );
  }
  // Anything that changed something is the one case where what a tab last
  // knew is worth less than nothing, so it goes rather than ages out.
  if (init?.method === "POST") {
    forgetOpened(
      OPENED_TOGETHER,
      OPENED_GISTS,
      OPENED_INTRODUCTIONS,
      OPENED_NOW,
    );
  }
  return payload.value;
}

export function loadTogether() {
  return togetherFetch<TogetherState>().then((value) =>
    rememberOpened(OPENED_TOGETHER, value),
  );
}

/** Read once when Together opens: what each of your worlds turns out to share. */
export function loadTogetherGists() {
  return togetherFetch<TogetherGistsState>({ path: "/gists" }).then((value) =>
    rememberOpened(OPENED_GISTS, value),
  );
}

/**
 * Who Chapter has noticed among the people you have not met. Read on the same
 * terms as gists: once when Together opens, never polled.
 */
export function loadIntroductions() {
  return togetherFetch<IntroductionsState>({ path: "/introductions" }).then(
    (value) => rememberOpened(OPENED_INTRODUCTIONS, value),
  );
}

/** The way out. There is no way in, because taking part discloses nothing. */
export function muteIntroductions() {
  return togetherFetch<{ introductionsMuted: boolean }>({
    path: "/introductions",
    method: "POST",
    body: { action: "mute", muted: true },
  });
}

export function answerIntroduction(
  introductionId: string,
  answer: "yes" | "no",
) {
  return togetherFetch<IntroductionAnswer>({
    path: "/introductions",
    method: "POST",
    body: { action: "answer", introductionId, answer },
  });
}

export function startTogetherChapter(connectionId: string) {
  return togetherFetch<{ chapter: TogetherChapterRecord }>({
    method: "POST",
    body: { action: "start", connectionId },
  });
}

/** The initiator has looked at the venue and is handing it over. */
export function sendTogetherChapter(
  chapterId: string,
  proposedFor: string,
  partnerName: string,
) {
  return togetherFetch<{ chapter: TogetherChapterRecord }>({
    method: "POST",
    body: { action: "send", chapterId, proposedFor, partnerName },
  });
}

export function acceptTogetherChapter(
  chapterId: string,
  scheduledFor: string,
  partnerName: string,
) {
  return togetherFetch<{ chapter: TogetherChapterRecord }>({
    method: "POST",
    body: { action: "accept", chapterId, scheduledFor, partnerName },
  });
}

export function declineTogetherChapter(
  chapterId: string,
  reason: string,
  partnerName: string,
) {
  return togetherFetch<{ chapter: TogetherChapterRecord }>({
    method: "POST",
    body: { action: "decline", chapterId, reason, partnerName },
  });
}

export function markTogetherChapterLived(
  chapterId: string,
  partnerName: string,
) {
  return togetherFetch<{ chapter: TogetherChapterRecord }>({
    method: "POST",
    body: { action: "lived", chapterId, partnerName },
  });
}

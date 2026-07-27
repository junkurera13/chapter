import { getAccessToken } from "@base44/sdk";

import type { TogetherChapterRecord } from "./togetherChapterSchema";

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

  const response = await fetch("/api/together", {
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
  return payload.value;
}

export function loadTogether() {
  return togetherFetch<TogetherState>();
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

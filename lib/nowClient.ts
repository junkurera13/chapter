import { getAccessToken } from "@base44/sdk";

import type { NowChapterRecord } from "./nowChapterSchema";

export type NowState = {
  homeCity: string;
  chapter: NowChapterRecord | null;
  avoidVenues?: string[];
};

export class NowRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NowRequestError";
  }
}

async function nowFetch<T>(init?: {
  method?: "POST";
  body?: Record<string, unknown>;
}): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new NowRequestError(
      "Your session expired.",
      "AUTHENTICATION_REQUIRED",
      401,
    );
  }

  const response = await fetch("/api/now", {
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
    throw new NowRequestError(
      payload.error || "Chapter couldn’t reach Now.",
      payload.code || "NOW_FAILED",
      response.status,
    );
  }
  return payload.value;
}

export function loadNow() {
  return nowFetch<NowState>();
}

export function saveHomeCity(homeCity: string) {
  return nowFetch<{ homeCity: string }>({
    method: "POST",
    body: { action: "setHomeCity", homeCity },
  });
}

export function startNowChapter() {
  return nowFetch<{ chapter: NowChapterRecord }>({
    method: "POST",
    body: { action: "start" },
  });
}

export function acceptNowChapter(chapterId: string, scheduledFor: string) {
  return nowFetch<{ chapter: NowChapterRecord }>({
    method: "POST",
    body: { action: "accept", chapterId, scheduledFor },
  });
}

export function declineNowChapter(chapterId: string, reason: string) {
  return nowFetch<{ chapter: NowChapterRecord }>({
    method: "POST",
    body: { action: "decline", chapterId, reason },
  });
}

export function markNowChapterLived(chapterId: string) {
  return nowFetch<{ chapter: NowChapterRecord }>({
    method: "POST",
    body: { action: "lived", chapterId },
  });
}

/** The soonest Saturday strictly after today, as YYYY-MM-DD. */
export function nextSaturdayIso(from = new Date()) {
  const date = new Date(from);
  const day = date.getDay();
  const daysUntil = ((6 - day + 7) % 7) || 7;
  date.setDate(date.getDate() + daysUntil);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const dayOfMonth = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
}

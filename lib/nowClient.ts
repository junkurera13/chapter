import { getAccessToken } from "@base44/sdk";

import type {
  NowChapterRecord,
  NowReach,
  NowTimeWindow,
} from "./nowChapterSchema";
import { isoDay } from "./nowSchedule";
import { forgetOpened, OPENED_NOW, rememberOpened } from "./openedViews";
import type { PlaceSuggestion } from "./placeSearch";

export type { PlaceSuggestion };

export type NowState = {
  homeCity: string;
  /**
   * The two standing habits every chapter is written from. Absent on an
   * account that has never been asked, which is a complete answer in itself:
   * the defaults are real answers, so nothing is ever waiting on them.
   */
  timeWindows?: NowTimeWindow[];
  reach?: NowReach;
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
  query?: Record<string, string>;
}): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new NowRequestError(
      "Your session expired.",
      "AUTHENTICATION_REQUIRED",
      401,
    );
  }

  const query = init?.query ? `?${new URLSearchParams(init.query)}` : "";
  const response = await fetch(`/api/now${query}`, {
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
  if (init?.method === "POST") forgetOpened(OPENED_NOW);
  return payload.value;
}

/** Reading Now, which never starts anything. Only a press does that. */
export function loadNow() {
  return nowFetch<NowState>().then((value) =>
    rememberOpened(OPENED_NOW, value),
  );
}

/** When you are usually free, and how far you will go. Kept on the account. */
export function saveNowPreferences(
  timeWindows: readonly NowTimeWindow[],
  reach: NowReach,
) {
  return nowFetch<{ timeWindows: NowTimeWindow[]; reach: NowReach }>({
    method: "POST",
    body: { action: "setPreferences", timeWindows, reach },
  });
}

export function saveHomeCity(homeCity: string) {
  return nowFetch<{ homeCity: string }>({
    method: "POST",
    body: { action: "setHomeCity", homeCity },
  });
}

/**
 * Type-ahead suggestions for the home-city ask. Aborting an in-flight lookup
 * rejects with the fetch AbortError, which callers ignore.
 */
export async function searchPlaceSuggestions(
  query: string,
  options: {
    near?: { latitude: number; longitude: number };
    signal?: AbortSignal;
  } = {},
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const accessToken = await getAccessToken();
  if (!accessToken) return [];

  const params = new URLSearchParams({ q: trimmed });
  if (options.near) {
    params.set("lat", `${options.near.latitude}`);
    params.set("lon", `${options.near.longitude}`);
  }

  const response = await fetch(`/api/places?${params}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    signal: options.signal,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    value?: { places?: PlaceSuggestion[] };
  };
  if (!response.ok) return [];
  return payload.value?.places ?? [];
}

/**
 * Write one, now. The whole of what the orb does.
 *
 * Carries only the day the person is standing in. When they are usually free
 * and how far they will go are read off the account by the server, so there is
 * one copy of them and a stale tab cannot research against an old answer.
 */
export function startNowChapter() {
  return nowFetch<{ chapter: NowChapterRecord }>({
    method: "POST",
    body: { action: "start", today: isoDay() },
  });
}

/**
 * The first memory's immediate payoff. The memory send is the person's
 * request; this starts one world-led experience without treating a sparse
 * graph as a profile.
 */
export function startFirstExperience() {
  return nowFetch<{ chapter: NowChapterRecord }>({
    method: "POST",
    body: { action: "startFirst", today: isoDay() },
  });
}

/**
 * Saying you are going, and when.
 *
 * Carries the day the person is standing in, because the day they picked is
 * only in the future on their own calendar: a Saturday in Seoul is not this
 * server's Saturday.
 */
export function acceptNowChapter(chapterId: string, scheduledFor: string) {
  return nowFetch<{ chapter: NowChapterRecord }>({
    method: "POST",
    body: { action: "accept", chapterId, scheduledFor, today: isoDay() },
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

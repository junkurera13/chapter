import { getAccessToken } from "@base44/sdk";

import type { WeeklyPackScale } from "./weeklyPackDesign";
import type { WeeklyExperiencePack } from "./weeklyPackSchema";

export class WeeklyPackRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WeeklyPackRequestError";
  }
}

async function weeklyPackFetch<T>(init?: {
  method?: "POST";
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new WeeklyPackRequestError(
      "Your session expired.",
      "AUTHENTICATION_REQUIRED",
      401,
    );
  }

  const query = init?.query ? `?${new URLSearchParams(init.query)}` : "";
  const response = await fetch(`/api/weekly-pack${query}`, {
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
    throw new WeeklyPackRequestError(
      payload.error || "Chapter couldn’t open this week’s pack.",
      payload.code || "WEEKLY_PACK_FAILED",
      response.status,
    );
  }
  return payload.value;
}

export function loadWeeklyPack() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return weeklyPackFetch<{
    pack: WeeklyExperiencePack | null;
    preparing: boolean;
    timezone: string;
    homeCity: string;
  }>({ query: { timezone } });
}

export type WeeklyPackGenerationResult = {
  pack: WeeklyExperiencePack | null;
  generationStatus: "idle" | "preparing";
};

export function createWeeklyPackExperiences() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return weeklyPackFetch<WeeklyPackGenerationResult>({
    method: "POST",
    body: { action: "create", timezone },
  });
}

export function advanceWeeklyPackGeneration() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return weeklyPackFetch<WeeklyPackGenerationResult>({
    method: "POST",
    body: { action: "advance", timezone },
  });
}

export function revealWeeklyCard(packId: string, cardId: WeeklyPackScale) {
  return weeklyPackFetch<{ pack: WeeklyExperiencePack }>({
    method: "POST",
    body: { action: "reveal", packId, cardId },
  });
}

export function chooseWeeklyCard(packId: string, cardId: WeeklyPackScale) {
  return weeklyPackFetch<{ pack: WeeklyExperiencePack }>({
    method: "POST",
    body: { action: "choose", packId, cardId },
  });
}

export function scheduleWeeklyCard(packId: string, scheduledFor: string) {
  return weeklyPackFetch<{ pack: WeeklyExperiencePack }>({
    method: "POST",
    body: { action: "schedule", packId, scheduledFor },
  });
}

export function dismissWeeklyPack(packId: string) {
  return weeklyPackFetch<{ pack: WeeklyExperiencePack }>({
    method: "POST",
    body: { action: "dismiss", packId },
  });
}

export function markWeeklyCardLived(packId: string) {
  return weeklyPackFetch<{ pack: WeeklyExperiencePack }>({
    method: "POST",
    body: { action: "lived", packId },
  });
}

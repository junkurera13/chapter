"use client";

/**
 * What a tab already knew when you last left it.
 *
 * Now and Together unmount when you switch away from them, and every read
 * behind them is expensive: a Vercel route, a Base44 function, several entity
 * queries, sometimes a model call. Without this, coming back a second time
 * costs exactly what coming back the first time did, and the tab opens on a
 * spinner it has no reason to show.
 *
 * So the last answer is kept in memory for the life of the page. A view seeds
 * itself from it synchronously and re-reads in the background: what you left
 * is on screen immediately, and what is true replaces it a moment later. This
 * is a cache of one page's own reads, not a store — nothing here outlives a
 * reload, and nothing here is ever the only copy of anything.
 */

/** Long enough to cross a tab, short enough that a stale answer can't linger. */
const OPENED_TTL_MS = 5 * 60 * 1000;

type Opened = { value: unknown; savedAt: number };

const opened = new Map<string, Opened>();

export function rememberOpened<T>(key: string, value: T): T {
  opened.set(key, { value, savedAt: Date.now() });
  return value;
}

export function lastOpened<T>(key: string): T | undefined {
  const entry = opened.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.savedAt > OPENED_TTL_MS) {
    opened.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/** After an action whose whole point was to change what the tab says. */
export function forgetOpened(...keys: string[]) {
  for (const key of keys) opened.delete(key);
}

export const OPENED_NOW = "now";
export const OPENED_TOGETHER = "together";
export const OPENED_GISTS = "together:gists";
export const OPENED_INTRODUCTIONS = "together:introductions";

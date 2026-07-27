/**
 * Invite links, remembered on the device that made them.
 *
 * A link is now stable — the same person gets the same one until it is used —
 * so it is worth keeping. Backend calls can take many seconds, and waiting for
 * one to hand a friend a link you already have is time spent on nothing.
 *
 * This is a convenience cache and nothing more: the backend remains the only
 * authority on whether a link still works.
 */

const STORAGE_KEY = "chapter.invite-links.v1";

type CachedLinks = Record<string, string>;

function readAll(): CachedLinks {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const links: CachedLinks = {};
    for (const [nodeId, url] of Object.entries(parsed as CachedLinks)) {
      if (typeof url === "string" && url) links[nodeId] = url;
    }
    return links;
  } catch {
    // Private browsing and quota errors are not worth a broken invite button.
    return {};
  }
}

function writeAll(links: CachedLinks) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch {
    // Same: losing the cache costs a wait, not a feature.
  }
}

export function readCachedInviteUrl(nodeId: string) {
  return readAll()[nodeId];
}

export function cacheInviteUrl(nodeId: string, url: string) {
  const links = readAll();
  if (links[nodeId] === url) return;
  links[nodeId] = url;
  writeAll(links);
}

/** Called once a connection exists: the link is spent and cannot be re-sent. */
export function forgetCachedInviteUrl(nodeId: string) {
  const links = readAll();
  if (!(nodeId in links)) return;
  delete links[nodeId];
  writeAll(links);
}

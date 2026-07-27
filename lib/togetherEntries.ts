import type { IntroductionRecord } from "./introductionSchema";
import type { TogetherChapterRecord } from "./togetherChapterSchema";
import type { TogetherGist } from "./togetherGistSchema";

/**
 * What Together shows, as one list.
 *
 * Chapter has three things it can know about another person: a gist it
 * noticed, an introduction to someone unmet, and a chapter already in motion.
 * They are stages of one relationship rather than three kinds of object, so
 * they collapse into one entry per person here, and the page renders one card
 * per entry. An introduction that becomes a connection keeps its place rather
 * than disappearing and being replaced.
 */

export const OPEN_STATUSES = [
  "researching",
  "draft",
  "proposed",
  "accepted",
] as const;

export function isOpen(chapter: TogetherChapterRecord) {
  return (OPEN_STATUSES as readonly string[]).includes(chapter.status);
}

/**
 * One person Chapter has something to say about, at whatever stage they are.
 *
 * `partnerName` is absent for exactly one reason: you have not met them yet.
 * Making that a missing field rather than a separate type is the point.
 */
export type TogetherEntry = {
  id: string;
  partnerName?: string;
  gist?: TogetherGist;
  introduction?: IntroductionRecord;
  chapter?: TogetherChapterRecord;
};

/**
 * What Chapter leads with. Anything waiting on this person comes first, then
 * anything it is still working on, then the gists it simply noticed.
 *
 * An offer from someone unmet sits just under a chapter a friend is waiting on
 * an answer to. It is the only thing on the page that expires, so it cannot
 * rest at the bottom, and a friend holding a date open is still the more
 * pressing of the two.
 */
export function priorityOf(entry: TogetherEntry) {
  const { chapter, introduction } = entry;
  if (chapter?.status === "proposed" && chapter.role === "partner") return 0;
  if (introduction?.state === "offered") return 1;
  if (chapter?.status === "draft") return 2;
  if (chapter?.status === "researching") return 3;
  if (chapter?.status === "accepted") return 4;
  if (chapter?.status === "proposed") return 5;
  return 6;
}

/** Sorts after every real name, so someone unmet never jumps the alphabet. */
const NO_NAME = "￿";

export function buildEntries(
  chapters: readonly TogetherChapterRecord[],
  gists: readonly TogetherGist[],
  introductions: readonly IntroductionRecord[],
): TogetherEntry[] {
  const byId = new Map<string, TogetherEntry>();
  for (const introduction of introductions) {
    byId.set(introduction.id, { id: introduction.id, introduction });
  }
  for (const gist of gists) {
    byId.set(gist.connectionId, {
      id: gist.connectionId,
      partnerName: gist.partnerName,
      gist,
    });
  }
  for (const chapter of chapters.filter(isOpen)) {
    const existing = byId.get(chapter.connectionId);
    byId.set(chapter.connectionId, {
      id: chapter.connectionId,
      partnerName: existing?.partnerName || chapter.partnerName,
      gist: existing?.gist,
      chapter,
    });
  }
  return [...byId.values()].sort(
    (first, second) =>
      priorityOf(first) - priorityOf(second) ||
      (first.partnerName ?? NO_NAME).localeCompare(
        second.partnerName ?? NO_NAME,
      ),
  );
}

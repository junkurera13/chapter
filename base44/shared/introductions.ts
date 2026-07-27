/**
 * An introduction between two people who have never met.
 *
 * Everything Chapter already does with two worlds assumes consent has been
 * given: an invite was accepted, so both people know each other's names. An
 * introduction has no such handshake to lean on, so the rules below are the
 * whole safety argument, and they live in shared/ so they can be tested rather
 * than trusted.
 *
 * The argument is short. A gist is the strict intersection of two shareable
 * graphs, so every word of it is already true in the reader's own world. A
 * sentence made only of things you already hold discloses nothing about the
 * other person, which is why an introduction can be offered before either
 * person has agreed to anything. Names, faces, counts, and the other person's
 * answer are all one-sided facts, and none of them appear here.
 */

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/**
 * One coincidence between strangers is noise. Two is a reason to look up.
 * Connected gists are allowed to run on one shared thread because the people
 * already know each other; an introduction has to carry the whole weight of
 * why these two, so it asks for more.
 */
export const INTRODUCTION_MIN_ANCHORS = 2;

/** Three threads is a sentence. Four is a list, and a list is not a gist. */
export const INTRODUCTION_MAX_ANCHORS = 3;

/**
 * Three open offers at once. Beyond that an introduction stops reading as
 * someone Chapter noticed for you and starts reading as a feed to work
 * through, which is the thing this product exists not to be.
 */
export const MAX_LIVE_INTRODUCTIONS = 3;

/** An offer nobody answered should stop waiting rather than sit forever. */
export const INTRODUCTION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** A ceiling on one scan, so a growing pool can never make one read unbounded. */
export const INTRODUCTION_SCAN_LIMIT = 200;

/**
 * How many candidate worlds one scan will actually open.
 *
 * The city filter is free; reading a graph is not, and a scan that opened
 * every world in a city would get slower for everyone precisely as the product
 * started working. Newest accounts are looked at first, so the people most
 * likely to be waiting for something to happen are the ones who get it.
 */
export const INTRODUCTION_GRAPH_READS = 24;

/** Candidate graphs read at once, so a scan is bounded in width as well as depth. */
export const INTRODUCTION_READ_BATCH = 6;

/** Splits work into fixed-size batches, so a scan can be bounded in width. */
export function batched<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export type IntroductionResponse = "pending" | "yes" | "no";

export type IntroductionSide = "a" | "b";

export type IntroductionCandidateNode = {
  label: string;
  category: string;
  salience: number;
};

export type IntroductionAnchor = {
  label: string;
  category: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsedJson(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Labels match across two worlds on meaning, not on typography. This is the
 * same normalisation the connected path uses in `lib/togetherGeneration.ts`,
 * repeated rather than imported because Deno and the app share no module
 * graph. The two must agree, so both are tested against the same cases.
 */
export function normalizeMatchLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Cities match the same way labels do, so "Fukuoka " and "fukuoka" are one place. */
export function normalizeCity(city: unknown) {
  return normalizeMatchLabel(text(city));
}

/** Stable regardless of who was scanning when the pair was found. */
export function introductionPairKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}

/**
 * Whether an account is in the pool.
 *
 * Taking part is the default, and that follows from the rule rather than being
 * a shortcut around it: a gist is the strict intersection, so what reaches a
 * stranger's screen is a sentence already true in their own world, and being
 * in the pool discloses nothing about you to anyone. There is nothing for an
 * opt-in to protect. Consent belongs where something actually crosses, which
 * is the second yes.
 *
 * A home city is the only requirement, because it is what makes two people
 * able to meet at all. Muting is the only way out, and it is honoured here as
 * well as in the query, so a stale row can never put a muted account back in.
 */
export function takesPartInIntroductions(row: Row) {
  if (row?.introductions_muted === true) return false;
  return Boolean(normalizeCity(row?.home_city));
}

/**
 * The threads two worlds genuinely hold in common, ranked by how much they
 * matter to the two people put together.
 *
 * Only the intersection survives. A label one side holds alone is not an
 * introduction and never leaves this function, which is the property the whole
 * consent argument rests on.
 */
export function sharedAnchorsBetween(
  mine: readonly IntroductionCandidateNode[],
  theirs: readonly IntroductionCandidateNode[],
  max = INTRODUCTION_MAX_ANCHORS,
): { anchors: IntroductionAnchor[]; weight: number } {
  const theirsByKey = new Map<string, IntroductionCandidateNode>();
  for (const node of theirs) {
    const key = normalizeMatchLabel(text(node?.label));
    if (key && !theirsByKey.has(key)) theirsByKey.set(key, node);
  }

  const matched: Array<{ anchor: IntroductionAnchor; weight: number }> = [];
  const seen = new Set<string>();
  for (const node of mine) {
    const label = text(node?.label);
    const key = normalizeMatchLabel(label);
    if (!key || seen.has(key)) continue;
    const match = theirsByKey.get(key);
    if (!match) continue;
    seen.add(key);
    matched.push({
      anchor: { label, category: text(node?.category) || "interest" },
      weight: numberOr(node?.salience, 0.6) + numberOr(match?.salience, 0.6),
    });
  }

  const ranked = matched.sort((first, second) => second.weight - first.weight);
  const kept = ranked.slice(0, max);
  return {
    anchors: kept.map((entry) => entry.anchor),
    // Ranked on everything the two worlds share, not only on what the sentence
    // has room to say, so a deep overlap outranks a shallow one.
    weight: ranked.reduce((total, entry) => total + entry.weight, 0),
  };
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function sideFor(row: Row, viewerUserId: string): IntroductionSide | undefined {
  if (row?.user_a_id === viewerUserId) return "a";
  if (row?.user_b_id === viewerUserId) return "b";
  return undefined;
}

export function responseOf(row: Row, side: IntroductionSide): IntroductionResponse {
  const value = text(side === "a" ? row?.user_a_response : row?.user_b_response);
  return value === "yes" || value === "no" ? value : "pending";
}

export function bothSaidYes(row: Row) {
  return responseOf(row, "a") === "yes" && responseOf(row, "b") === "yes";
}

export function eitherSaidNo(row: Row) {
  return responseOf(row, "a") === "no" || responseOf(row, "b") === "no";
}

/**
 * Whether an offer is still live for either person.
 *
 * A declined introduction is over for both sides at once, and neither is told
 * which of them ended it. Being turned down by a stranger you never met is not
 * information anybody needs, and the pair is never offered again.
 */
export function isLiveIntroduction(row: Row, now: number) {
  if (text(row?.status) !== "offered") return false;
  if (eitherSaidNo(row)) return false;
  return numberOr(row?.expires_at, 0) > now;
}

export type IntroductionRecord = {
  id: string;
  line: string;
  anchors: IntroductionAnchor[];
  /** "offered" until this reader answers, then "waiting" until the other does. */
  state: "offered" | "waiting";
  expiresAt: number;
};

/**
 * One stored row as one of the two people may see it.
 *
 * Deliberately absent: the other person's name, their id, their city, and
 * whether they have answered yet. That last one is the subtle one. Knowing
 * someone is already waiting on you would change the answer you give, and it
 * is a fact about them rather than about the two of you, so it stays on the
 * server until the moment it stops being private: when both have said yes and
 * a real connection exists, at which point they arrive through the ordinary
 * connections path with a name attached.
 */
export function introductionRecordFor(
  row: Row,
  viewerUserId: string,
  now: number,
): IntroductionRecord | undefined {
  const side = sideFor(row, viewerUserId);
  if (!side || !isLiveIntroduction(row, now)) return undefined;

  const anchors = parsedJson(row.anchors_json);
  return {
    id: text(row.id),
    line: text(row.line),
    anchors: Array.isArray(anchors)
      ? anchors
        .map((anchor: Row) => ({
          label: text(anchor?.label),
          category: text(anchor?.category) || "interest",
        }))
        .filter((anchor: IntroductionAnchor) => anchor.label)
      : [],
    state: responseOf(row, side) === "yes" ? "waiting" : "offered",
    expiresAt: numberOr(row.expires_at, 0),
  };
}

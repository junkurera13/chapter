/**
 * Last-resort fallback when the generated environmental image is unavailable.
 *
 * Most researched pages carry an Open Graph photograph chosen by their author.
 * This keeps a pack usable during a provider outage without allowing image
 * generation failure to erase three days of design and research work.
 */

const FETCH_TIMEOUT_MS = 4000;
const MAX_PAGES = 4;
/** Enough for any plausible <head>; the rest of the document is never read. */
const MAX_BYTES = 120_000;

const META_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
];

const DIMENSION_PATTERNS = {
  width: /<meta[^>]+property=["']og:image:width["'][^>]*>/i,
  height: /<meta[^>]+property=["']og:image:height["'][^>]*>/i,
};

/**
 * Files that are plainly not a picture of anywhere: marks, avatars, the little
 * square a site falls back to when a page has no picture of its own.
 */
const NOT_A_PHOTO =
  /(logo|favicon|sprite|icon|avatar|profile|placeholder|default[-_]?(image|thumb)|banner|watermark)/i;

/**
 * Where a page's own picture is usually a designed graphic rather than a
 * photograph: blog platforms and social posts lead with a title card, often
 * with the venue's name set across it in large type. Those are still worth
 * having when nothing else turns up, so they go to the back rather than out.
 */
const DESIGNS_ITS_THUMBNAIL =
  /(^|\.)(blog\.naver\.com|m\.blog\.naver\.com|tistory\.com|brunch\.co\.kr|instagram\.com|facebook\.com|twitter\.com|x\.com|pinterest\.|youtube\.com|youtu\.be|threads\.net|velog\.io|medium\.com)$/i;

/**
 * Hosts nobody's research should be citing, and which a fetch from inside the
 * deployment could otherwise reach on the network's behalf.
 */
const BLOCKED_HOST = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (BLOCKED_HOST.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function contentAttribute(tag: string) {
  return /content=["']([^"']+)["']/i.exec(tag)?.[1];
}

/** Reads at most the first stretch of a page, which is where a <head> lives. */
async function readHead(url: URL, signal?: AbortSignal) {
  const response = await fetch(url, {
    signal,
    redirect: "follow",
    headers: {
      // Some sites serve their Open Graph tags only to things that look like a
      // browser asking for a page.
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (compatible; ChapterBot/1.0; +https://chapter.app)",
    },
  });
  if (!response.ok) return "";
  if (!response.headers.get("content-type")?.includes("html")) return "";

  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let html = "";
  try {
    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return html;
}

type Candidate = { url: string; score: number };

/**
 * How much this looks like a photograph of a place, rather than a graphic about
 * one. Nothing here can read what is printed across an image, so this ranks
 * where a picture came from and what shape it is, which is the most a page's
 * own markup will tell you.
 */
function scorePhoto(image: URL, page: URL, width?: number, height?: number) {
  let score = 0;

  if (DESIGNS_ITS_THUMBNAIL.test(page.hostname)) score -= 3;
  if (NOT_A_PHOTO.test(image.pathname)) score -= 5;

  if (width && height) {
    // A photograph is wide or tall. A title card is usually a neat 1:1 or a
    // wide strip built to a template, and a small square is a thumbnail.
    const ratio = width / height;
    if (width >= 1000) score += 2;
    else if (width >= 600) score += 1;
    else if (width <= 300) score -= 2;
    if (ratio > 0.9 && ratio < 1.1) score -= 1;
    if (ratio >= 1.2 && ratio <= 2.1) score += 1;
  }

  return score;
}

async function photoOn(pageUrl: string): Promise<Candidate | undefined> {
  const page = safeUrl(pageUrl);
  if (!page) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const html = await readHead(page, controller.signal);
    const width = Number(
      contentAttribute(DIMENSION_PATTERNS.width.exec(html)?.[0] ?? "") ?? "",
    );
    const height = Number(
      contentAttribute(DIMENSION_PATTERNS.height.exec(html)?.[0] ?? "") ?? "",
    );

    for (const pattern of META_PATTERNS) {
      const tag = pattern.exec(html)?.[0];
      const raw = tag && contentAttribute(tag);
      if (!raw) continue;
      // Relative paths are common and resolve against the page they came from.
      const image = safeUrl(new URL(raw, page).toString());
      if (!image) continue;
      return {
        url: image.toString(),
        score: scorePhoto(
          image,
          page,
          Number.isFinite(width) ? width : undefined,
          Number.isFinite(height) ? height : undefined,
        ),
      };
    }
    return undefined;
  } catch {
    // A page that will not load is not an error worth failing a chapter over.
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The best picture across the cited pages.
 *
 * Every page is read rather than stopping at the first hit, because the page
 * research ranked first is often a blog whose own thumbnail is a title card
 * with the venue's name set across it. Given the choice between that and a
 * plain photograph further down the list, the photograph wins.
 *
 * Returns undefined when none of them carry a picture, which is a complete
 * answer: the card is built to stand without one.
 */
export async function findVenuePhoto(
  citations: readonly { url: string }[],
): Promise<string | undefined> {
  const found = await Promise.all(
    citations.slice(0, MAX_PAGES).map((citation) => photoOn(citation.url)),
  );

  const ranked = found
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .filter((candidate) => candidate.score > -5)
    .sort((first, second) => second.score - first.score);

  return ranked[0]?.url;
}

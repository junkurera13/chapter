/**
 * The "yes" someone gives before they have an account.
 *
 * Tapping "Join Chapter" on an invitation is consent to connect, but the
 * signup happens elsewhere and lands them back on the invitation. Without
 * something carrying that yes across the trip, they return to the same button
 * and have to press it again, which reads as a loop.
 *
 * The guards matter more than the convenience. Opening an invite link must
 * never connect anyone by itself — only finishing a signup they started:
 *
 * - it is scoped to one code, so a different invitation is not accepted;
 * - it expires, so an abandoned signup does not connect someone days later;
 * - it is consumed on read, so it can only ever act once.
 */

const STORAGE_KEY = "chapter.invite-intent.v1";
const TTL_MS = 20 * 60 * 1000;

export function rememberJoinIntent(code: string, now = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code, at: now }),
    );
  } catch {
    // Without storage they press the button once more. Not worth failing over.
  }
}

/** True when this exact invitation was accepted before signing up. */
export function takeJoinIntent(code: string, now = Date.now()) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    window.localStorage.removeItem(STORAGE_KEY);

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    const { code: saved, at } = parsed as { code?: unknown; at?: unknown };
    return saved === code && typeof at === "number" && now - at < TTL_MS;
  } catch {
    return false;
  }
}

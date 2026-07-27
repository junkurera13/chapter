import "server-only";

/**
 * The backend's own words about a failure, for a screen that is being looked
 * at by whoever can fix it.
 *
 * In production a person is told plumbing failed and nothing more: a backend's
 * wording is not written for them, and a status code tells them nothing they
 * can act on. Outside production the opposite is true. The one thing anyone
 * debugging needs is which failure it was — a 403 and a 500 mean completely
 * different things and the sentence "Together isn't reachable" covers both —
 * and they are looking at the browser, not at a terminal.
 */
export function withBackendDetail(
  message: string,
  error: unknown,
  status?: number,
) {
  if (process.env.NODE_ENV === "production") return message;
  const detail = error instanceof Error ? error.message : String(error);
  return `${message} [dev: ${status ?? "no status"} ${detail}]`;
}

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export type WeeklySocialCompany = "known-person" | "new-person";

/**
 * A connection created from Chapter's stranger-introduction path is still a
 * new person until an actual meeting is lived. A named invite begins familiar.
 */
export function weeklyCompanyForConnection(
  connection: Row,
): WeeklySocialCompany {
  return connection?.origin === "introduction" &&
      !Number(connection?.met_at)
    ? "new-person"
    : "known-person";
}

export function weeklyCompanionFamiliarity(
  company: WeeklySocialCompany,
) {
  return company === "new-person" ? "new" as const : "known" as const;
}

const ANONYMOUS_PERSON_LANGUAGE =
  /\b(someone new|a new person|a stranger|someone you (?:do not|don't|haven't|have not) (?:know|met)|someone you already know|someone you know|a friend|your friend|bring someone)\b/i;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The Base44 boundary repeats the final public-card invariants rather than
 * trusting a model caller or a TypeScript parser that does not run in Deno.
 * This also prevents an old generic social pack from resurfacing after the
 * product contract changed.
 */
export function weeklyCardsHaveConcretePeopleAndPlaces(value: unknown) {
  if (!Array.isArray(value) || value.length !== 3) return false;
  return value.every((card: Row) => {
    if (
      !text(card?.id) ||
      !text(card?.place?.name) ||
      !text(card?.place?.area) ||
      !text(card?.place?.address)
    ) {
      return false;
    }
    if (card?.company === "self") return !card?.companion;
    if (
      card?.company !== "new-person" &&
      card?.company !== "known-person"
    ) {
      return false;
    }
    if (
      !text(card?.companion?.connectionId) ||
      !text(card?.companion?.userId) ||
      !text(card?.companion?.name) ||
      (card.company === "new-person" &&
        card.companion?.familiarity !== "new") ||
      (card.company === "known-person" &&
        card.companion?.familiarity !== "known")
    ) {
      return false;
    }
    const copy = [
      card?.title,
      card?.line,
      card?.promise,
      card?.opening,
      ...(Array.isArray(card?.steps) ? card.steps : []),
    ].map(text).join("\n");
    return !ANONYMOUS_PERSON_LANGUAGE.test(copy);
  });
}

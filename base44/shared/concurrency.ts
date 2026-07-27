/**
 * How many people's worlds may be open at once inside one request.
 *
 * Reading them one after another is what made Together slow, but reading all
 * of them at once is worse than slow. Every open world is two five-thousand
 * row queries, and every row it returns stays in the instance's memory until
 * the whole request is done, where it used to be one small function
 * invocation per person. Sequential reads were also, accidentally, the only
 * thing holding this function under the entity API's rate limit. A few at a
 * time keeps most of the speed and gives both of those back.
 *
 * Lives in shared/ so the ceiling can be tested rather than trusted.
 */
export const OPEN_WORLDS_AT_ONCE = 3;

/**
 * Promise.all with a ceiling.
 *
 * Results come back in the order the items went in, whatever order they
 * finish in, and one rejection rejects the whole call exactly as Promise.all
 * does — so callers that already catch per item keep catching per item.
 */
export async function mapWithLimit<Item, Result>(
  items: readonly Item[],
  limit: number,
  map: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await map(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

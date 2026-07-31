import { describe, expect, it } from "vitest";

import { mapWithLimit } from "../../shared/concurrency";

/** Resolves when told to, so a test can hold work open and count it. */
function held<T>() {
  let release: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release: (value: T) => release(value) };
}

describe("reading a few worlds at a time", () => {
  it("never has more than the limit in flight", async () => {
    let inFlight = 0;
    let highWater = 0;
    const result = await mapWithLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight += 1;
      highWater = Math.max(highWater, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return n * 2;
    });

    expect(highWater).toBe(3);
    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it("keeps input order even when the slow ones finish last", async () => {
    const result = await mapWithLimit(
      ["slow", "fast", "medium"],
      3,
      async (label) => {
        const delay = label === "slow" ? 20 : label === "medium" ? 10 : 0;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return label;
      },
    );
    expect(result).toEqual(["slow", "fast", "medium"]);
  });

  it("starts the next item as soon as a slot frees, not after a whole batch", async () => {
    const first = held<string>();
    const started: number[] = [];

    const all = mapWithLimit([0, 1, 2, 3], 2, async (n) => {
      started.push(n);
      if (n === 0) return first.promise;
      return `done ${n}`;
    });

    await Promise.resolve();
    await Promise.resolve();
    // One slot is held by item 0, so items 1 and 2 pass through the other and
    // item 3 follows — the held item must not block the whole run.
    expect(started).toContain(1);
    first.release("done 0");
    await expect(all).resolves.toEqual([
      "done 0",
      "done 1",
      "done 2",
      "done 3",
    ]);
  });

  it("handles a limit larger than the work, and a limit of zero", async () => {
    await expect(mapWithLimit([1, 2], 10, async (n) => n)).resolves.toEqual([
      1, 2,
    ]);
    await expect(mapWithLimit([1, 2], 0, async (n) => n)).resolves.toEqual([
      1, 2,
    ]);
  });

  it("rejects like Promise.all, so per-item catches still work", async () => {
    await expect(
      mapWithLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("world unreachable");
        return n;
      }),
    ).rejects.toThrow("world unreachable");

    const caught = await mapWithLimit([1, 2, 3], 2, async (n) => {
      try {
        if (n === 2) throw new Error("world unreachable");
        return n;
      } catch {
        return undefined;
      }
    });
    expect(caught).toEqual([1, undefined, 3]);
  });

});

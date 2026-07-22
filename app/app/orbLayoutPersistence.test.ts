import { describe, expect, it } from "vitest";
import {
  ORB_LAYOUT_STORAGE_KEY,
  loadOrbLayout,
  saveOrbLayout,
  type OrbPosition,
} from "./orbLayoutPersistence";

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem(key: string) {
      return key === ORB_LAYOUT_STORAGE_KEY ? value : null;
    },
    setItem(key: string, nextValue: string) {
      if (key === ORB_LAYOUT_STORAGE_KEY) value = nextValue;
    },
  };
}

describe("orb layout persistence", () => {
  it("round-trips positions by stable orb key", () => {
    const storage = createMemoryStorage();
    const positions = new Map<string, OrbPosition>([
      ["self", [0.4, -0.2, 0.8]],
      ["island_ride", [2.6, 1.1, -0.3]],
    ]);

    expect(saveOrbLayout(storage, positions)).toBe(true);
    expect(
      loadOrbLayout(storage, new Set(["self", "island_ride"])),
    ).toEqual(positions);
  });

  it("ignores removed or invalid orb entries", () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        version: 1,
        positions: {
          self: [0.5, 0.2, 0.1],
          removed_orb: [1, 2, 3],
          broken: [Number.POSITIVE_INFINITY, 0, 0],
        },
      }),
    );

    expect(loadOrbLayout(storage, new Set(["self", "broken"]))).toEqual(
      new Map([["self", [0.5, 0.2, 0.1]]]),
    );
  });

  it("falls back safely when stored data is corrupt", () => {
    const storage = createMemoryStorage("not-json");

    expect(loadOrbLayout(storage, new Set(["self"]))).toEqual(new Map());
  });
});

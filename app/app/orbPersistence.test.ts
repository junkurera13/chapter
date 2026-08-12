import { describe, expect, it } from "vitest";

import {
  loadSeenNodeKeys,
  ORB_BIRTH_STORAGE_KEY,
} from "./orbBirth";
import {
  loadOrbLayout,
  ORB_LAYOUT_STORAGE_KEY,
} from "./orbLayoutPersistence";

function createStorage(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial));

  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("Chapter browser-state rename", () => {
  it("migrates the previous seen-node key without losing state", () => {
    const legacyKey = "sidequest:you-world:seen-node-keys:v1";
    const storage = createStorage({
      [legacyKey]: JSON.stringify({ version: 1, keys: ["self", "place:cafe"] }),
    });

    const seen = loadSeenNodeKeys(
      storage,
      new Set(["self", "place:cafe"]),
    );

    expect([...seen]).toEqual(["self", "place:cafe"]);
    expect(storage.values.has(legacyKey)).toBe(false);
    expect(storage.values.get(ORB_BIRTH_STORAGE_KEY)).toBe(
      JSON.stringify({ version: 1, keys: ["self", "place:cafe"] }),
    );
  });

  it("migrates the previous orb-layout key without losing positions", () => {
    const legacyKey = "sidequest:you-world:orb-layout:v1";
    const legacyLayout = JSON.stringify({
      version: 1,
      positions: { self: [0, 0, 0], "place:cafe": [1, 2, 3] },
    });
    const storage = createStorage({ [legacyKey]: legacyLayout });

    const positions = loadOrbLayout(
      storage,
      new Set(["self", "place:cafe"]),
    );

    expect(positions.get("place:cafe")).toEqual([1, 2, 3]);
    expect(storage.values.has(legacyKey)).toBe(false);
    expect(storage.values.get(ORB_LAYOUT_STORAGE_KEY)).toBe(legacyLayout);
  });
});

import { describe, expect, it } from "vitest";

import {
  ORB_BIRTH_STORAGE_KEY,
  loadSeenNodeKeys,
  orderUnseenNodeKeys,
  rangeProgress,
  saveSeenNodeKeys,
  strongEaseOut,
  unitProgress,
} from "./orbBirth";

describe("seen node identity storage", () => {
  const allowedKeys = new Set(["self", "root", "child"]);

  it("returns an empty set for corrupt or unavailable storage", () => {
    expect(loadSeenNodeKeys(null, allowedKeys)).toEqual(new Set());
    expect(
      loadSeenNodeKeys(
        { getItem: () => "not json" },
        allowedKeys,
      ),
    ).toEqual(new Set());
    expect(
      loadSeenNodeKeys(
        {
          getItem: () => {
            throw new Error("blocked");
          },
        },
        allowedKeys,
      ),
    ).toEqual(new Set());
  });

  it("accepts only current, allowed identities", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          version: 1,
          keys: ["self", "root", "removed", "root", 12],
        }),
    };

    expect(loadSeenNodeKeys(storage, allowedKeys)).toEqual(
      new Set(["self", "root"]),
    );
    expect(
      loadSeenNodeKeys(
        { getItem: () => JSON.stringify({ version: 2, keys: ["root"] }) },
        allowedKeys,
      ),
    ).toEqual(new Set());
  });

  it("writes the exact versioned shape and survives blocked storage", () => {
    let storedKey = "";
    let storedValue = "";
    const storage = {
      setItem: (key: string, value: string) => {
        storedKey = key;
        storedValue = value;
      },
    };

    expect(saveSeenNodeKeys(storage, new Set(["self", "root"]))).toBe(true);
    expect(storedKey).toBe(ORB_BIRTH_STORAGE_KEY);
    expect(JSON.parse(storedValue)).toEqual({
      version: 1,
      keys: ["self", "root"],
    });
    expect(
      saveSeenNodeKeys(
        {
          setItem: () => {
            throw new Error("blocked");
          },
        },
        new Set(["root"]),
      ),
    ).toBe(false);
  });
});

describe("orderUnseenNodeKeys", () => {
  const nodes = [
    { key: "self" },
    { key: "root_b" },
    { key: "child_b" },
    { key: "root_a" },
    { key: "child_a" },
    { key: "island" },
  ];
  const edges = [
    { from: "root_b", to: "child_b" },
    { from: "self", to: "root_a" },
    { from: "root_a", to: "child_a" },
    { from: "self", to: "root_b" },
  ];

  it("orders by breadth-first depth and preserves source order within it", () => {
    expect(orderUnseenNodeKeys(nodes, edges, new Set())).toEqual([
      "root_b",
      "root_a",
      "child_b",
      "child_a",
      "island",
    ]);
  });

  it("excludes the centre and seen keys while retaining traversal through them", () => {
    expect(
      orderUnseenNodeKeys(nodes, edges, new Set(["root_b", "child_a"])),
    ).toEqual(["root_a", "child_b", "island"]);
  });

  it("places disconnected nodes last in stable source order", () => {
    const disconnectedNodes = [
      { key: "self" },
      { key: "lonely_b" },
      { key: "root" },
      { key: "lonely_a" },
    ];
    expect(
      orderUnseenNodeKeys(
        disconnectedNodes,
        [{ from: "self", to: "root" }],
        new Set(),
      ),
    ).toEqual(["root", "lonely_b", "lonely_a"]);
  });
});

describe("orb birth progress", () => {
  it("clamps time progress and handles a zero duration", () => {
    expect(unitProgress(99, 100, 400)).toBe(0);
    expect(unitProgress(300, 100, 400)).toBe(0.5);
    expect(unitProgress(900, 100, 400)).toBe(1);
    expect(unitProgress(100, 100, 0)).toBe(1);
    expect(unitProgress(Number.NaN, 100, 400)).toBe(0);
  });

  it("evaluates the exact strong ease-out endpoints monotonically", () => {
    expect(strongEaseOut(0)).toBe(0);
    expect(strongEaseOut(1)).toBe(1);
    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(strongEaseOut);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThan(samples[index - 1]);
    }
    expect(strongEaseOut(-2)).toBe(0);
    expect(strongEaseOut(2)).toBe(1);
  });

  it("maps label and edge windows into clamped unit progress", () => {
    expect(rangeProgress(0.17, 0.18, 0.82)).toBe(0);
    expect(rangeProgress(0.5, 0.18, 0.82)).toBeCloseTo(0.5);
    expect(rangeProgress(0.9, 0.18, 0.82)).toBe(1);
    expect(rangeProgress(0.42, 0.42, 0.88)).toBe(0);
    expect(rangeProgress(0.65, 0.42, 0.88)).toBeCloseTo(0.5);
    expect(rangeProgress(0.88, 0.42, 0.88)).toBe(1);
  });
});

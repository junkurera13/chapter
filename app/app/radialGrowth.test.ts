import { describe, expect, it } from "vitest";
import {
  placeOrbOutward,
  resolveOutwardPositions,
  type GrowthNode,
  type PositionedGrowthNode,
} from "./radialGrowth";

const centre: PositionedGrowthNode<GrowthNode> = {
  key: "self",
  radius: 0.9,
  position: [0, 0, 0],
};

describe("radial growth placement", () => {
  it("places a child beyond its connected parent", () => {
    const parent: PositionedGrowthNode<GrowthNode> = {
      key: "parent",
      radius: 0.5,
      position: [2.2, 0, 0],
    };
    const child = placeOrbOutward(
      { key: "child", radius: 0.4 },
      [parent.key],
      [centre, parent],
    );

    expect(Math.hypot(child[0], child[1])).toBeGreaterThan(
      Math.hypot(parent.position[0], parent.position[1]),
    );
    expect(child[0]).toBeGreaterThan(parent.position[0]);
  });

  it("fans siblings around a shared parent without stacking them", () => {
    const parent: PositionedGrowthNode<GrowthNode> = {
      key: "parent",
      radius: 0.5,
      position: [2.2, 0, 0],
    };
    const firstPosition = placeOrbOutward(
      { key: "first-child", radius: 0.42 },
      [parent.key],
      [centre, parent],
    );
    const first: PositionedGrowthNode<GrowthNode> = {
      key: "first-child",
      radius: 0.42,
      position: firstPosition,
    };
    const secondPosition = placeOrbOutward(
      { key: "second-child", radius: 0.42 },
      [parent.key],
      [centre, parent, first],
    );

    expect(secondPosition).not.toEqual(firstPosition);
    expect(
      Math.hypot(
        secondPosition[0] - firstPosition[0],
        secondPosition[1] - firstPosition[1],
        secondPosition[2] - firstPosition[2],
      ),
    ).toBeGreaterThan(1);
  });

  it("assigns each branch root its own direction around the circle", () => {
    const nodes: readonly GrowthNode[] = [
      centre,
      { key: "memory-a", radius: 0.5 },
      { key: "memory-b", radius: 0.5 },
      { key: "memory-c", radius: 0.5 },
    ];
    const edges = [
      { from: "self", to: "memory-a" },
      { from: "self", to: "memory-b" },
      { from: "self", to: "memory-c" },
    ];

    const positioned = resolveOutwardPositions(nodes, edges);
    const angles = positioned
      .slice(1)
      .map((node) => Math.atan2(node.position[1], node.position[0]));

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 1; index < angles.length; index += 1) {
      let separation = Math.abs(angles[index] - angles[0]);
      separation = Math.min(separation, Math.PI * 2 - separation);
      const expected = (index * goldenAngle) % (Math.PI * 2);
      const expectedSeparation = Math.min(expected, Math.PI * 2 - expected);
      expect(Math.abs(separation - expectedSeparation)).toBeLessThan(0.5);
    }
  });

  it("keeps a memory's nodes chained inside its branch sector", () => {
    const childKeys = ["friend", "place", "food", "feeling", "activity"];
    const nodes: readonly GrowthNode[] = [
      centre,
      { key: "memory", radius: 0.55 },
      ...childKeys.map((key) => ({ key, radius: 0.42 })),
    ];
    const edges = [
      { from: "self", to: "memory" },
      ...childKeys.map((key) => ({ from: "memory", to: key })),
    ];

    const positioned = resolveOutwardPositions(nodes, edges);
    const byKey = new Map(positioned.map((node) => [node.key, node]));
    const memory = byKey.get("memory")!;
    const memoryAngle = Math.atan2(memory.position[1], memory.position[0]);
    const memoryDistance = Math.hypot(memory.position[0], memory.position[1]);

    for (const key of childKeys) {
      const child = byKey.get(key)!;
      const childAngle = Math.atan2(child.position[1], child.position[0]);
      let separation = Math.abs(childAngle - memoryAngle);
      separation = Math.min(separation, Math.PI * 2 - separation);

      expect(separation).toBeLessThan(1);
      expect(
        Math.hypot(child.position[0], child.position[1]),
      ).toBeGreaterThan(memoryDistance);
    }
  });

  it("chains a node under its high-priority connection, not the moment", () => {
    // The activity appears BEFORE the person in source order; only its higher
    // anchorPriority lets the person place first so the activity chains
    // beyond it instead of sitting on the moment's ring.
    const nodes: readonly GrowthNode[] = [
      centre,
      { key: "memory", radius: 0.55 },
      { key: "activity", radius: 0.42, anchorPriority: 1 },
      { key: "person", radius: 0.45, anchorPriority: 3 },
    ];
    const edges = [
      { from: "self", to: "memory" },
      { from: "memory", to: "activity" },
      { from: "memory", to: "person" },
      { from: "activity", to: "person" },
    ];

    const positioned = resolveOutwardPositions(nodes, edges);
    const byKey = new Map(positioned.map((node) => [node.key, node]));
    const activity = byKey.get("activity")!;
    const person = byKey.get("person")!;
    const memory = byKey.get("memory")!;

    const planarDistance = (position: readonly [number, number, number]) =>
      Math.hypot(position[0], position[1]);
    const gap = (
      a: readonly [number, number, number],
      b: readonly [number, number, number],
    ) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

    expect(planarDistance(activity.position)).toBeGreaterThan(
      planarDistance(person.position),
    );
    expect(gap(activity.position, person.position)).toBeLessThan(
      gap(activity.position, memory.position),
    );
  });

  it("resolves chained generated nodes deterministically", () => {
    const nodes: readonly GrowthNode[] = [
      centre,
      { key: "root", radius: 0.5 },
      { key: "leaf", radius: 0.35 },
    ];
    const edges = [
      { from: "self", to: "root" },
      { from: "root", to: "leaf" },
    ];

    const first = resolveOutwardPositions(nodes, edges);
    const second = resolveOutwardPositions(nodes, edges);
    const rootDistance = Math.hypot(
      first[1].position[0],
      first[1].position[1],
    );
    const leafDistance = Math.hypot(
      first[2].position[0],
      first[2].position[1],
    );

    expect(first).toEqual(second);
    expect(leafDistance).toBeGreaterThan(rootDistance);
  });
});

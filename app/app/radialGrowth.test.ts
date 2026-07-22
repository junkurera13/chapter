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

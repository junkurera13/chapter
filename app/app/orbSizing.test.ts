import { describe, expect, it } from "vitest";

import {
  MAX_ORB_RADIUS,
  MIN_ORB_RADIUS,
  SELF_ORB_RADIUS,
  resolveOrbSizes,
} from "./orbSizing";

describe("resolveOrbSizes", () => {
  it("keeps the person as the single fixed centre", () => {
    const [self] = resolveOrbSizes(
      [{ key: "self", category: "self", salience: 0 }],
      [],
    );

    expect(self.radius).toBe(SELF_ORB_RADIUS);
    expect(self.major).toBe(true);
  });

  it("makes evidenced importance the dominant sizing signal", () => {
    const nodes = resolveOrbSizes(
      [
        { key: "incidental", category: "place", salience: 0.2 },
        { key: "meaningful", category: "place", salience: 0.9 },
      ],
      [],
    );

    expect(nodes[1].radius).toBeGreaterThan(nodes[0].radius);
    expect(nodes[1].radius - nodes[0].radius).toBeGreaterThan(0.15);
    expect(nodes[1].major).toBe(true);
    expect(nodes[0].major).toBe(false);
  });

  it("gently reinforces strong and repeated relationships", () => {
    const nodes = resolveOrbSizes(
      [
        { key: "lightly_connected", category: "feeling", salience: 0.6 },
        { key: "deeply_connected", category: "feeling", salience: 0.6 },
        { key: "one", category: "activity", salience: 0.4 },
        { key: "two", category: "people", salience: 0.4 },
      ],
      [
        { from: "lightly_connected", to: "one", strength: 0.3 },
        { from: "deeply_connected", to: "one", strength: 0.95 },
        { from: "deeply_connected", to: "two", strength: 0.9 },
      ],
    );

    expect(nodes[1].radius).toBeGreaterThan(nodes[0].radius);
  });

  it("does not use category as a hidden size bias", () => {
    const nodes = resolveOrbSizes(
      [
        { key: "place", category: "place", salience: 0.7 },
        { key: "feeling", category: "feeling", salience: 0.7 },
      ],
      [],
    );

    expect(nodes[0].radius).toBe(nodes[1].radius);
  });

  it("keeps every non-self orb inside the designed range", () => {
    const nodes = resolveOrbSizes(
      [
        { key: "small", category: "condition", salience: -4 },
        { key: "large", category: "experience", salience: 8 },
      ],
      [{ from: "large", to: "small", strength: 9 }],
    );

    for (const node of nodes) {
      expect(node.radius).toBeGreaterThanOrEqual(MIN_ORB_RADIUS);
      expect(node.radius).toBeLessThanOrEqual(MAX_ORB_RADIUS);
    }
  });

  it("uses a neutral fallback for graph rows created before salience", () => {
    const [legacy] = resolveOrbSizes(
      [{ key: "legacy", category: "pattern" }],
      [],
    );

    expect(legacy.radius).toBeGreaterThan(MIN_ORB_RADIUS);
    expect(legacy.radius).toBeLessThan(MAX_ORB_RADIUS);
  });
});

import { describe, expect, it } from "vitest";

import {
  CAMERA_DAMPING,
  CURSOR_INFLUENCE_PADDING,
  CURSOR_VICINITY_INNER_GAP,
  CURSOR_VICINITY_PEAK,
  MAX_FOCUS_DISTANCE,
  MAX_FRAME_DELTA,
  MIN_FOCUS_DISTANCE,
  SELECTED_LABEL_HERO_SCALE,
  SELECTED_SELF_LABEL_HERO_SCALE,
  cursorVicinityInfluence,
  focusDistance,
  frameDamping,
  heroLabelScale,
} from "./orbMotion";

describe("focusDistance", () => {
  it("clamps small and large orbs to the designed focus range", () => {
    expect(focusDistance(0)).toBe(MIN_FOCUS_DISTANCE);
    expect(focusDistance(0.1)).toBe(MIN_FOCUS_DISTANCE);
    expect(focusDistance(2)).toBe(MAX_FOCUS_DISTANCE);
  });

  it("grows monotonically between the clamps", () => {
    expect(focusDistance(0.34)).toBeLessThan(focusDistance(0.48));
    expect(focusDistance(0.48)).toBeLessThan(focusDistance(0.6));
  });
});

describe("frameDamping", () => {
  it("stays inside the interpolation range and grows with elapsed time", () => {
    const shortFrame = frameDamping(1 / 120);
    const longFrame = frameDamping(1 / 30);

    expect(shortFrame).toBeGreaterThanOrEqual(0);
    expect(longFrame).toBeLessThanOrEqual(1);
    expect(longFrame).toBeGreaterThan(shortFrame);
  });

  it("clamps long frame gaps and handles invalid time safely", () => {
    expect(frameDamping(2)).toBe(
      1 - Math.exp(-CAMERA_DAMPING * MAX_FRAME_DELTA),
    );
    expect(frameDamping(Number.NaN)).toBe(0);
    expect(frameDamping(-1)).toBe(0);
  });
});

describe("heroLabelScale", () => {
  it("moves a non-self label between its base and hero floor", () => {
    expect(heroLabelScale(0.8, false, 0)).toBe(0.8);
    expect(heroLabelScale(0.8, false, 0.5)).toBeCloseTo(0.99);
    expect(heroLabelScale(0.8, false, 1)).toBe(
      SELECTED_LABEL_HERO_SCALE,
    );
  });

  it("uses the larger self floor without reducing an already larger base", () => {
    expect(heroLabelScale(0.8, true, 1)).toBe(
      SELECTED_SELF_LABEL_HERO_SCALE,
    );
    expect(heroLabelScale(1.42, false, 1)).toBe(1.42);
    expect(heroLabelScale(1.42, true, 1)).toBe(1.42);
  });

  it("clamps emphasis and returns a safe scale for invalid input", () => {
    expect(heroLabelScale(0.8, false, -1)).toBe(0.8);
    expect(heroLabelScale(0.8, false, 2)).toBe(
      SELECTED_LABEL_HERO_SCALE,
    );
    expect(heroLabelScale(Number.NaN, false, 0)).toBe(
      SELECTED_LABEL_HERO_SCALE,
    );
    expect(heroLabelScale(Number.POSITIVE_INFINITY, true, 0.5)).toBe(
      SELECTED_SELF_LABEL_HERO_SCALE,
    );
  });
});

describe("cursorVicinityInfluence", () => {
  const radius = 40;

  it("is still over the globe and at both ring bounds", () => {
    expect(cursorVicinityInfluence(0, radius)).toBe(0);
    expect(cursorVicinityInfluence(radius, radius)).toBe(0);
    expect(
      cursorVicinityInfluence(radius + CURSOR_VICINITY_INNER_GAP, radius),
    ).toBe(0);
    expect(
      cursorVicinityInfluence(radius + CURSOR_INFLUENCE_PADDING, radius),
    ).toBe(0);
    expect(cursorVicinityInfluence(radius + 80, radius)).toBe(0);
  });

  it("peaks at the designed surface distance", () => {
    expect(
      cursorVicinityInfluence(radius + CURSOR_VICINITY_PEAK, radius),
    ).toBe(1);
  });

  it("rises and falls smoothly while staying inside the range", () => {
    const risingSamples = [8, 12, 16, 20, 24].map((surfaceDistance) =>
      cursorVicinityInfluence(radius + surfaceDistance, radius),
    );
    const fallingSamples = [24, 34, 44, 54, 64].map((surfaceDistance) =>
      cursorVicinityInfluence(radius + surfaceDistance, radius),
    );

    for (const sample of [...risingSamples, ...fallingSamples]) {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    }
    for (let index = 1; index < risingSamples.length; index += 1) {
      expect(risingSamples[index]).toBeGreaterThanOrEqual(
        risingSamples[index - 1],
      );
    }
    for (let index = 1; index < fallingSamples.length; index += 1) {
      expect(fallingSamples[index]).toBeLessThanOrEqual(
        fallingSamples[index - 1],
      );
    }
  });

  it("handles invalid and out-of-range inputs safely", () => {
    const invalidSamples = [
      cursorVicinityInfluence(Number.NaN, radius),
      cursorVicinityInfluence(Number.POSITIVE_INFINITY, radius),
      cursorVicinityInfluence(-1, radius),
      cursorVicinityInfluence(80, Number.NaN),
      cursorVicinityInfluence(80, -1),
    ];

    for (const sample of invalidSamples) {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
      expect(sample).toBe(0);
    }
  });
});

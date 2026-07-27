import { describe, expect, it } from "vitest";

import { shouldPlayAgentOrb } from "./agent-orb-video";

describe("agent orb playback", () => {
  it("plays an ambient orb only while visible and motion is allowed", () => {
    expect(
      shouldPlayAgentOrb({
        documentVisible: true,
        isVisible: true,
        playWhileMounted: false,
        reducedMotion: false,
      }),
    ).toBe(true);
    expect(
      shouldPlayAgentOrb({
        documentVisible: true,
        isVisible: false,
        playWhileMounted: false,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldPlayAgentOrb({
        documentVisible: true,
        isVisible: true,
        playWhileMounted: false,
        reducedMotion: true,
      }),
    ).toBe(false);
  });

  it("keeps a mounted loading orb moving without playing in a hidden tab", () => {
    expect(
      shouldPlayAgentOrb({
        documentVisible: true,
        isVisible: false,
        playWhileMounted: true,
        reducedMotion: true,
      }),
    ).toBe(true);
    expect(
      shouldPlayAgentOrb({
        documentVisible: false,
        isVisible: true,
        playWhileMounted: true,
        reducedMotion: false,
      }),
    ).toBe(false);
  });
});

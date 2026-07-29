import { describe, expect, it, vi } from "vitest";

import {
  runWeeklyPackModelAttempts,
  weeklyPackReasoningEffortFor,
} from "./weeklyPackGeneration";

describe("weekly pack model attempts", () => {
  it("routes reasoning effort through OpenRouter model settings", () => {
    expect(
      weeklyPackReasoningEffortFor("anthropic/claude-sonnet-5"),
    ).toBe("low");
    expect(weeklyPackReasoningEffortFor("openai/gpt-5.4-mini")).toBe(
      "minimal",
    );
    expect(weeklyPackReasoningEffortFor("moonshotai/kimi-k2.6")).toBe(
      "none",
    );
    expect(
      weeklyPackReasoningEffortFor(
        "anthropic/claude-sonnet-5",
        "none",
      ),
    ).toBe("none");
  });

  it("lets the primary model repair its own deterministic failure before fallback", async () => {
    const attempt = vi.fn(
      async ({
        modelId,
        attempt: attemptNumber,
        correction,
      }: {
        modelId: string;
        attempt: number;
        correction: string;
      }) => {
        if (modelId === "primary" && attemptNumber === 1) {
          return {
            failure: "SELF_PERSON_STRETCH",
            correction: "Keep every solo card person-familiar.",
          };
        }
        return { value: `${modelId}:${correction}` };
      },
    );

    const result = await runWeeklyPackModelAttempts({
      modelIds: ["primary", "fallback"],
      attempt,
    });

    expect(result.value).toBe(
      "primary:Keep every solo card person-familiar.",
    );
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(attempt.mock.calls.map(([value]) => value.modelId)).toEqual([
      "primary",
      "primary",
    ]);
  });

  it("retries an empty primary result before moving to fallback", async () => {
    const attempt = vi.fn(
      async ({
        modelId,
        attempt: attemptNumber,
      }: {
        modelId: string;
        attempt: number;
        correction: string;
      }) =>
        modelId === "fallback"
          ? { value: "accepted" }
          : {
              failure: "No output generated.",
              correction: `repair-${attemptNumber}`,
            },
    );

    const result = await runWeeklyPackModelAttempts({
      modelIds: ["primary", "fallback"],
      attempt,
    });

    expect(result.value).toBe("accepted");
    expect(attempt.mock.calls.map(([value]) => value.modelId)).toEqual([
      "primary",
      "primary",
      "fallback",
    ]);
  });
});

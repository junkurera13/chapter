/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const agentSecret = "chapter-test-secret";
const principal = "+821012345678";

const experience = {
  kind: "andy" as const,
  title: "Tea above the old market",
  summary: "Walk the market once, then have one quiet pot of tea upstairs.",
  durationMinutes: 75,
  stops: [
    {
      name: "Example Tea Room",
      address: "1 Market Street, Seoul",
      activity: "Choose one unfamiliar tea and sit by the window.",
      hours: "Daily 12:00-20:00",
      price: "About ₩12,000",
    },
  ],
  gettingThere: "A five-minute walk from Example Station exit 2.",
  whyThisFits: "It has novelty without turning the afternoon into a project.",
  sources: [
    { label: "Official site", url: "https://example.com/tea" },
    { label: "Map listing", url: "https://example.org/map" },
  ],
  verifiedAt: "2026-08-10T12:00:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("CHAPTER_AGENT_SECRET", agentSecret);
});

describe("Chapter iMessage product state", () => {
  test("moves from one memory to location to a saved experience", async () => {
    const t = convexTest(schema, modules);

    expect(
      await t.query(internal.chapterAgent.getContext, {
        externalPrincipalId: principal,
      }),
    ).toMatchObject({ onboardingStage: "needs_memory", memories: [] });

    const memory = await t.mutation(internal.chapterAgent.saveMemory, {
      externalPrincipalId: principal,
      idempotencyKey: "memory-1",
      text: "Cycling beside the river with my brother after the rain.",
    });
    expect(memory.onboardingStage).toBe("needs_location");

    await t.mutation(internal.chapterAgent.saveLocation, {
      externalPrincipalId: principal,
      city: "Seoul",
      area: "Hannam",
      country: "South Korea",
    });

    const saved = await t.mutation(internal.chapterAgent.saveExperience, {
      externalPrincipalId: principal,
      idempotencyKey: "experience-1",
      requestText: "Give me an Andy",
      experience,
    });
    expect(saved.status).toBe("sent");

    const feedback = await t.mutation(internal.chapterAgent.saveFeedback, {
      externalPrincipalId: principal,
      idempotencyKey: "feedback-1",
      verdict: "save",
    });
    expect(feedback).toMatchObject({
      experienceId: saved.experienceId,
      title: experience.title,
      verdict: "save",
    });

    expect(
      await t.query(internal.chapterAgent.getContext, {
        externalPrincipalId: principal,
      }),
    ).toMatchObject({
      onboardingStage: "complete",
      location: { city: "Seoul", area: "Hannam" },
      memories: [{ text: expect.stringContaining("Cycling") }],
      recentExperiences: [{ title: experience.title, status: "saved" }],
    });
  });

  test("the HTTP boundary rejects callers without the private agent secret", async () => {
    const t = convexTest(schema, modules);
    const response = await t.fetch("/chapter-agent", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operation: "get_context",
        externalPrincipalId: principal,
      }),
    });
    expect(response.status).toBe(401);
  });

  test("the HTTP boundary forwards an authenticated Chapter operation", async () => {
    const t = convexTest(schema, modules);
    const response = await t.fetch("/chapter-agent", {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operation: "get_context",
        externalPrincipalId: principal,
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      onboardingStage: "needs_memory",
    });
  });
});

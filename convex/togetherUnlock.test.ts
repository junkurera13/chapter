/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { TOGETHER_LOCKED_MESSAGE } from "../lib/togetherUnlock";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const memory = {
  source: "onboarding" as const,
  rawText: "Cycling beside the river with my brother after the rain.",
  title: "After the rain",
  summary: "A quiet river ride shared with a sibling.",
  sources: [],
  nodes: [
    {
      localKey: "memory",
      category: "experience" as const,
      subtype: "meaningful_memory",
      label: "River ride",
      description: "A bicycle ride beside the river after rainfall.",
      certainty: "fact" as const,
      confidence: 0.98,
      salience: 0.9,
      evidence: "The person described cycling beside the river.",
    },
  ],
  edges: [],
};

const andy = {
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
      price: "About 12,000",
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

async function inviteSomeone(
  user: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  token = "a".repeat(40),
) {
  const personReferenceId = await user.mutation(api.people.create, {
    displayName: "Sam",
  });
  return user.mutation(api.connections.createInvite, {
    personReferenceId,
    token,
  });
}

describe("Together unlock", () => {
  test("stays locked until five memories or five lived Andys and Marcos", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "together-user", name: "Together" });
    await user.mutation(api.accounts.ensureCurrent, { displayName: "Together" });

    expect(await user.query(api.connections.togetherReady, {})).toMatchObject({
      unlocked: false,
      memoryCount: 0,
      completedExperienceCount: 0,
    });
    await expect(inviteSomeone(user)).rejects.toThrow(TOGETHER_LOCKED_MESSAGE);

    for (let index = 0; index < 4; index += 1) {
      await user.mutation(api.webMemory.persistExtraction, {
        ...memory,
        clientRequestId: `memory-${index}`,
      });
    }
    expect(await user.query(api.connections.togetherReady, {})).toMatchObject({
      unlocked: false,
      memoryCount: 4,
    });

    await user.mutation(api.webMemory.persistExtraction, {
      ...memory,
      clientRequestId: "memory-4",
    });
    expect(await user.query(api.connections.togetherReady, {})).toMatchObject({
      unlocked: true,
      memoryCount: 5,
    });
    await expect(inviteSomeone(user, "b".repeat(40))).resolves.toMatchObject({
      expiresAt: expect.any(Number),
    });
  });

  test("opens after five completed Andys even without memories", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "andy-user", name: "Andy" });
    await user.mutation(api.accounts.ensureCurrent, { displayName: "Andy" });

    for (let index = 0; index < 5; index += 1) {
      const experienceId = await user.mutation(api.webExperiences.saveGenerated, {
        kind: "andy",
        requestText: `Nearby afternoon ${index + 1}`,
        experience: { ...andy, title: `Tea ${index + 1}` },
      });
      await user.mutation(api.webExperiences.updateStatus, {
        experienceId,
        status: "done",
      });
    }

    expect(await user.query(api.connections.togetherReady, {})).toMatchObject({
      unlocked: true,
      memoryCount: 0,
      completedExperienceCount: 5,
    });
  });
});

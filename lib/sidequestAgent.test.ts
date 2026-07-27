import { beforeEach, describe, expect, it, vi } from "vitest";

const extractMemory = vi.hoisted(() => vi.fn());
const prepareMemory = vi.hoisted(() => vi.fn());
const completeMemory = vi.hoisted(() => vi.fn());
const failMemory = vi.hoisted(() => vi.fn());

vi.mock("./memoryExtractor", () => ({
  extractMemory,
}));

vi.mock("./sidequestAgentBackend", () => ({
  prepareMemory,
  completeMemory,
  failMemory,
}));

import { extractAndPersistMemory } from "./sidequestAgent";

const extraction = {
  title: "Rainy afternoon in Busan",
  summary: "A calm rainy afternoon by the sea with Mina.",
  nodes: [],
  edges: [],
};

beforeEach(() => {
  extractMemory.mockReset();
  prepareMemory.mockReset();
  completeMemory.mockReset();
  failMemory.mockReset();
  vi.stubEnv("SIDEQUEST_INTERNAL_SECRET", "test-secret");
});

describe("extractAndPersistMemory", () => {
  it("extracts directly and persists the validated graph", async () => {
    const signal = new AbortController().signal;
    prepareMemory.mockResolvedValue({
      alreadyComplete: false,
      memoryId: "memory_1",
      prompt: "Extract this memory.",
      attachments: [
        {
          url: "https://example.com/photo.jpg",
          fileName: "photo.jpg",
          mediaType: "image/jpeg",
        },
      ],
    });
    extractMemory.mockResolvedValue(extraction);
    completeMemory.mockResolvedValue({
      memoryId: "memory_1",
      ...extraction,
      created: true,
    });

    const result = await extractAndPersistMemory({
      authUserId: "user_1",
      phone: "+14155550143",
      clientRequestId: "request_123",
      source: "onboarding",
      text: "A rainy afternoon in Busan.",
      images: [],
      accessToken: "access-token",
      signal,
    });

    expect(extractMemory).toHaveBeenCalledWith({
      prompt: "Extract this memory.",
      attachments: [
        {
          url: "https://example.com/photo.jpg",
          fileName: "photo.jpg",
          mediaType: "image/jpeg",
        },
      ],
      requestId: "request_123",
      signal,
    });
    expect(completeMemory).toHaveBeenCalledWith(
      {
        authUserId: "user_1",
        phone: "+14155550143",
        memoryId: "memory_1",
        extraction,
      },
      "access-token",
    );
    expect(failMemory).not.toHaveBeenCalled();
    expect(result.created).toBe(true);
  });

  it("returns an already completed idempotent memory without another model call", async () => {
    prepareMemory.mockResolvedValue({
      alreadyComplete: true,
      memoryId: "memory_complete",
      title: "Already there",
      summary: "Previously completed.",
    });

    await expect(
      extractAndPersistMemory({
        authUserId: "user_complete",
        clientRequestId: "request_complete",
        source: "reflection",
        text: "A memory.",
        images: [],
        accessToken: "access-token",
      }),
    ).resolves.toEqual({
      memoryId: "memory_complete",
      title: "Already there",
      summary: "Previously completed.",
      created: false,
    });

    expect(extractMemory).not.toHaveBeenCalled();
    expect(completeMemory).not.toHaveBeenCalled();
    expect(failMemory).not.toHaveBeenCalled();
  });

  it("removes the pending Base44 attempt when extraction fails", async () => {
    prepareMemory.mockResolvedValue({
      alreadyComplete: false,
      memoryId: "memory_2",
      prompt: "Extract this memory.",
      attachments: [],
    });
    extractMemory.mockRejectedValue(new Error("model unavailable"));
    failMemory.mockResolvedValue({ failed: true });

    await expect(
      extractAndPersistMemory({
        authUserId: "user_2",
        clientRequestId: "request_456",
        source: "reflection",
        text: "A memory.",
        images: [],
        accessToken: "access-token",
      }),
    ).rejects.toThrow("model unavailable");

    expect(completeMemory).not.toHaveBeenCalled();
    expect(failMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: "user_2",
        memoryId: "memory_2",
      }),
      "access-token",
    );
  });
});

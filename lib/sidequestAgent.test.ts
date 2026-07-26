import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
const prepareMemory = vi.hoisted(() => vi.fn());
const completeMemory = vi.hoisted(() => vi.fn());
const failMemory = vi.hoisted(() => vi.fn());

vi.mock("eve/client", () => ({
  Client: class {
    session() {
      return {
        send,
        state: { streamIndex: 0 },
      };
    }
  },
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
  send.mockReset();
  prepareMemory.mockReset();
  completeMemory.mockReset();
  failMemory.mockReset();
  vi.stubEnv("SIDEQUEST_INTERNAL_SECRET", "test-secret");
});

describe("extractAndPersistMemory", () => {
  it("retries a fresh Eve session when the first structured result is missing", async () => {
    prepareMemory.mockResolvedValue({
      alreadyComplete: false,
      memoryId: "memory_1",
      prompt: "Extract this memory.",
      attachments: [],
    });
    send
      .mockResolvedValueOnce({
        result: vi.fn().mockResolvedValue({
          status: "waiting",
          data: undefined,
        }),
      })
      .mockResolvedValueOnce({
        result: vi.fn().mockResolvedValue({
          status: "waiting",
          data: extraction,
        }),
      });
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
      origin: "https://chapter.example",
    });

    expect(send).toHaveBeenCalledTimes(2);
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

  it("marks the Base44 memory failed only after both Eve attempts miss", async () => {
    prepareMemory.mockResolvedValue({
      alreadyComplete: false,
      memoryId: "memory_2",
      prompt: "Extract this memory.",
      attachments: [],
    });
    send.mockResolvedValue({
      result: vi.fn().mockResolvedValue({
        status: "waiting",
        data: undefined,
      }),
    });
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
    ).rejects.toThrow("after two attempts");

    expect(send).toHaveBeenCalledTimes(2);
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

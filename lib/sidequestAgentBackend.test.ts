import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  prepareMemory,
  SidequestBackendError,
} from "./sidequestAgentBackend";

beforeEach(() => {
  vi.stubEnv("SIDEQUEST_INTERNAL_SECRET", "test-secret");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Base44 function reliability", () => {
  it("retries a transient origin failure without changing the request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json(
          { error: "temporary origin failure" },
          { status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          value: {
            alreadyComplete: false,
            memoryId: "memory_1",
            prompt: "Extract this.",
            attachments: [],
          },
        }),
      );

    await expect(
      prepareMemory({
        authUserId: "user_1",
        clientRequestId: "request_1",
        source: "onboarding",
        text: "A memory.",
        images: [],
      }, "access-token"),
    ).resolves.toMatchObject({ memoryId: "memory_1" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      fetchMock.mock.calls[1]?.[1]?.body,
    );
  });

  it("does not retry a permanent validation failure", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: "invalid memory", code: "MEMORY_INPUT_INVALID" },
        { status: 400 },
      ),
    );

    await expect(
      prepareMemory({
        authUserId: "user_1",
        clientRequestId: "request_1",
        source: "onboarding",
        text: "",
        images: [],
      }, "access-token"),
    ).rejects.toEqual(
      expect.objectContaining<Partial<SidequestBackendError>>({
        status: 400,
        code: "MEMORY_INPUT_INVALID",
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

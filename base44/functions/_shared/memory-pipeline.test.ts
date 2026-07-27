import { describe, expect, it, vi } from "vitest";

import {
  failExperienceMemory,
  signedImageUrls,
  type ExperienceMemoryInput,
  type MemoryImageInput,
} from "../../shared/memory-pipeline";

const image: MemoryImageInput = {
  sourceRef: "image:0",
  fileUri: "files/user-owned/image.png",
  fileName: "image.png",
  mediaType: "image/png",
  byteSize: 128,
  context: "",
  position: 0,
};

const memoryInput: ExperienceMemoryInput = {
  user: { id: "user-1" },
  phone: "",
  authUserId: "auth-user-1",
  source: "onboarding",
  clientRequestId: "request-123",
  text: "A memory",
  images: [],
};

describe("private memory image signing", () => {
  it("uses the caller-scoped signer as the privacy check without assuming a URI prefix", async () => {
    const callerSigner = vi.fn().mockResolvedValue({
      signed_url: "https://signed.example/image.png",
    });
    const serviceRoleSigner = vi.fn();
    const base44 = {
      integrations: {
        Core: { CreateFileSignedUrl: callerSigner },
      },
      asServiceRole: {
        integrations: {
          Core: { CreateFileSignedUrl: serviceRoleSigner },
        },
      },
    };

    await expect(signedImageUrls(base44, [image])).resolves.toEqual([
      "https://signed.example/image.png",
    ]);
    expect(callerSigner).toHaveBeenCalledWith({
      file_uri: image.fileUri,
      expires_in: 3600,
    });
    expect(serviceRoleSigner).not.toHaveBeenCalled();
  });

  it("turns rejected or stale image references into a recoverable client error", async () => {
    const signer = vi.fn().mockRejectedValue(new Error("denied"));
    const base44 = {
      integrations: {
        Core: {
          CreateFileSignedUrl: signer,
        },
      },
    };

    await expect(signedImageUrls(base44, [image])).rejects.toMatchObject({
      name: "MemoryPipelineError",
      status: 422,
      code: "IMAGE_REFERENCE_INVALID",
      message:
        "Chapter couldn’t securely open image.png. Add it again when you start over.",
    });
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it("signs multiple images sequentially to avoid integration bursts", async () => {
    let active = 0;
    let maxActive = 0;
    const signer = vi.fn().mockImplementation(async ({ file_uri }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { signed_url: `https://signed.example/${file_uri}` };
    });
    const base44 = {
      integrations: {
        Core: { CreateFileSignedUrl: signer },
      },
    };
    const images = [0, 1, 2].map((position) => ({
      ...image,
      fileUri: `files/user-owned/image-${position}.png`,
      fileName: `image-${position}.png`,
      position,
    }));

    await expect(signedImageUrls(base44, images)).resolves.toHaveLength(3);
    expect(signer).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
  });

  it("retries a transient signing failure", async () => {
    vi.useFakeTimers();
    const signer = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({
        signed_url: "https://signed.example/image.png",
      });
    const base44 = {
      integrations: {
        Core: { CreateFileSignedUrl: signer },
      },
    };
    const result = signedImageUrls(base44, [image]);

    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual([
      "https://signed.example/image.png",
    ]);
    expect(signer).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("failed memory cleanup", () => {
  it("deletes the graph, sources, and memory record for an incomplete attempt", async () => {
    const deleteEdges = vi.fn().mockResolvedValue({ deleted: 1 });
    const deleteNodes = vi.fn().mockResolvedValue({ deleted: 2 });
    const deleteSources = vi.fn().mockResolvedValue({ deleted: 3 });
    const deleteMemory = vi.fn().mockResolvedValue({ success: true });
    const base44 = {
      asServiceRole: {
        entities: {
          ExperienceGraphEdge: { deleteMany: deleteEdges },
          ExperienceGraphNode: { deleteMany: deleteNodes },
          ExperienceMemorySource: { deleteMany: deleteSources },
          ExperienceMemory: {
            get: vi.fn().mockResolvedValue({
              id: "memory-1",
              owner_user_id: memoryInput.user.id,
              status: "pending",
            }),
            delete: deleteMemory,
          },
        },
      },
    };

    await expect(
      failExperienceMemory(base44, memoryInput, "memory-1"),
    ).resolves.toEqual({ failed: true });
    expect(deleteEdges).toHaveBeenCalledWith({ memory_id: "memory-1" });
    expect(deleteNodes).toHaveBeenCalledWith({ memory_id: "memory-1" });
    expect(deleteSources).toHaveBeenCalledWith({ memory_id: "memory-1" });
    expect(deleteMemory).toHaveBeenCalledWith("memory-1");
  });

  it("never deletes a completed memory", async () => {
    const deleteMemory = vi.fn();
    const base44 = {
      asServiceRole: {
        entities: {
          ExperienceMemory: {
            get: vi.fn().mockResolvedValue({
              id: "memory-1",
              owner_user_id: memoryInput.user.id,
              status: "complete",
            }),
            delete: deleteMemory,
          },
        },
      },
    };

    await expect(
      failExperienceMemory(base44, memoryInput, "memory-1"),
    ).resolves.toEqual({ failed: false });
    expect(deleteMemory).not.toHaveBeenCalled();
  });
});

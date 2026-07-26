import { describe, expect, it, vi } from "vitest";

import {
  signedImageUrls,
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
    const base44 = {
      integrations: {
        Core: {
          CreateFileSignedUrl: vi.fn().mockRejectedValue(new Error("denied")),
        },
      },
    };

    await expect(signedImageUrls(base44, [image])).rejects.toMatchObject({
      name: "MemoryPipelineError",
      status: 422,
      code: "IMAGE_REFERENCE_INVALID",
    });
  });
});

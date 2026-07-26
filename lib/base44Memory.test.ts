import { describe, expect, it } from "vitest";

import { describeMemorySubmissionFailure } from "./base44Memory";

describe("memory submission failures", () => {
  it("marks rejected image references for a clean re-upload", () => {
    expect(
      describeMemorySubmissionFailure({
        status: 422,
        data: {
          code: "IMAGE_REFERENCE_INVALID",
          error: "That photo needs to be uploaded again.",
        },
      }),
    ).toEqual({
      message: "That photo needs to be uploaded again.",
      reuploadImages: true,
      requiresAuthentication: false,
    });
  });

  it("keeps in-progress retries from re-uploading photos", () => {
    expect(
      describeMemorySubmissionFailure({
        response: {
          status: 409,
          data: { code: "MEMORY_IN_PROGRESS" },
        },
      }),
    ).toEqual({
      message:
        "Chapter is still working on this memory. Give it a moment, then retry.",
      reuploadImages: false,
      requiresAuthentication: false,
    });
  });

  it("identifies an expired authenticated session", () => {
    expect(
      describeMemorySubmissionFailure({
        status: 401,
        data: { code: "AUTHENTICATION_REQUIRED" },
      }),
    ).toEqual({
      message:
        "Your session expired. Sign in in a new tab, then come back and retry—this draft will stay here.",
      reuploadImages: false,
      requiresAuthentication: true,
    });
  });

  it("uses a calm recoverable fallback for unknown provider failures", () => {
    expect(describeMemorySubmissionFailure(new Error("provider details"))).toEqual(
      {
        message:
          "Chapter couldn’t finish that memory just now. Your draft and photos are still here—try again.",
        reuploadImages: false,
        requiresAuthentication: false,
      },
    );
  });
});

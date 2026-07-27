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
      requiresAuthentication: false,
    });
  });

  it("describes an in-progress submission without claiming a saved draft", () => {
    expect(
      describeMemorySubmissionFailure({
        response: {
          status: 409,
          data: { code: "MEMORY_IN_PROGRESS" },
        },
      }),
    ).toEqual({
      message:
        "Chapter is still working on this memory. Start again in a moment.",
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
      message: "Your session expired. Sign in again, then start once more.",
      requiresAuthentication: true,
    });
  });

  it("uses a calm recoverable fallback for unknown provider failures", () => {
    expect(describeMemorySubmissionFailure(new Error("provider details"))).toEqual(
      {
        message: "Chapter couldn’t finish that memory just now. Start again.",
        requiresAuthentication: false,
      },
    );
  });
});

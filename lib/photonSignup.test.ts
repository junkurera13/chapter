import { describe, expect, it, vi } from "vitest";

import { createSharedPhotonUser } from "./photonSignup";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createSharedPhotonUser", () => {
  it("retries Photon rate limits and returns the assigned phone", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, {
          succeed: false,
          code: "RATE_LIMITED",
          message: "Too many requests",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          succeed: true,
          data: { assignedPhoneNumber: "+14155550123" },
        }),
      );

    const assignedPhone = await createSharedPhotonUser({
      projectId: "project-123",
      projectSecret: "secret-123",
      phoneNumber: "+821012345678",
      fetchImpl,
      sleep: async () => {},
    });

    expect(assignedPhone).toBe("+14155550123");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

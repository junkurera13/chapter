import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Base44FunctionError,
  fetchMySession,
} from "./base44Functions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Base44 authenticated function reliability", () => {
  it("retries a transient session lookup failure", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ error: "origin unavailable" }, { status: 503 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          value: {
            viewer: {
              id: "user_1",
              email: "person@example.com",
              messagingConnected: false,
            },
          },
        }),
      );

    await expect(fetchMySession("access-token")).resolves.toMatchObject({
      viewer: { id: "user_1" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an expired session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "authentication required" }, { status: 401 }),
    );

    await expect(fetchMySession("expired-token")).rejects.toEqual(
      expect.objectContaining<Partial<Base44FunctionError>>({ status: 401 }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

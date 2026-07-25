import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("./base44BrowserClient", () => ({
  getBase44BrowserClient: () => ({
    functions: { invoke },
  }),
}));

describe("loadMyConnections", () => {
  beforeEach(() => {
    invoke.mockReset();
    vi.resetModules();
  });

  it("coalesces concurrent connection loads and reuses the short cache", async () => {
    const connections = { accepted: [], pending: [] };
    invoke.mockResolvedValue({ data: { value: connections } });
    const { loadMyConnections } = await import("./base44Connections");

    const [first, second] = await Promise.all([
      loadMyConnections(),
      loadMyConnections(),
    ]);
    const third = await loadMyConnections();

    expect(first).toEqual(connections);
    expect(second).toEqual(connections);
    expect(third).toEqual(connections);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("invalidates the connection cache after creating an invite", async () => {
    const empty = { accepted: [], pending: [] };
    const invite = {
      inviteId: "invite-id",
      token: "invite-token",
      invitedName: "Sam",
      expiresAt: 123,
    };
    invoke
      .mockResolvedValueOnce({ data: { value: empty } })
      .mockResolvedValueOnce({ data: { value: invite } })
      .mockResolvedValueOnce({ data: { value: empty } });
    const { createConnectionInvite, loadMyConnections } =
      await import("./base44Connections");

    await loadMyConnections();
    await createConnectionInvite("node-id");
    await loadMyConnections();

    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke.mock.calls[1]?.[1]).toEqual({
      action: "createConnectionInvite",
      nodeId: "node-id",
    });
  });
});

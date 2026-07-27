import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchParallelResearchResult,
  ParallelResearchError,
  startParallelResearch,
} from "./parallelResearch";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("PARALLEL_API_KEY", "test-key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("startParallelResearch", () => {
  it("creates a run and returns its id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(202, { run_id: "trun_1", status: "queued" }),
    );

    const { runId } = await startParallelResearch({
      input: "find something rare",
      outputSchema: { type: "object" },
    });

    expect(runId).toBe("trun_1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.parallel.ai/v1/tasks/runs");
    expect(init.headers["x-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body.processor).toBeTruthy();
    expect(body.task_spec.output_schema.json_schema).toEqual({
      type: "object",
    });
  });

  it("throws a typed error when Parallel rejects the run", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "bad key" }));

    await expect(
      startParallelResearch({ input: "x", outputSchema: {} }),
    ).rejects.toBeInstanceOf(ParallelResearchError);
  });
});

describe("fetchParallelResearchResult", () => {
  it("returns pending while the run is still active", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        run: { run_id: "trun_1", status: "running" },
      }),
    );

    await expect(fetchParallelResearchResult("trun_1")).resolves.toEqual({
      status: "pending",
    });
  });

  it("treats Parallel's blocking timeout as pending", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(408, {}));

    await expect(fetchParallelResearchResult("trun_1")).resolves.toEqual({
      status: "pending",
    });
  });

  it("returns content and deduplicated citations when completed", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        run: { run_id: "trun_1", status: "completed" },
        output: {
          type: "json",
          content: { venue: "Somewhere rare" },
          basis: [
            {
              field: "venue",
              citations: [
                { url: "https://a.example", title: "A" },
                { url: "https://b.example" },
              ],
            },
            {
              field: "why",
              citations: [{ url: "https://a.example", title: "A again" }],
            },
          ],
        },
      }),
    );

    const result = await fetchParallelResearchResult("trun_1");
    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.content).toEqual({ venue: "Somewhere rare" });
    expect(result.citations).toEqual([
      { url: "https://a.example", title: "A" },
      { url: "https://b.example", title: undefined },
    ]);
  });

  it("reports failed runs", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        run: { run_id: "trun_1", status: "failed" },
      }),
    );

    await expect(fetchParallelResearchResult("trun_1")).resolves.toEqual({
      status: "failed",
    });
  });
});

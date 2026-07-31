import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  fetchParallelResearchResult,
  parallelCompatibleOutputSchema,
  startParallelResearch,
} from "./parallelResearch";
import { weeklyPackResearchFindingSchema } from "./weeklyPackDesign";

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
  it("removes Parallel-unsupported JSON Schema annotations recursively", () => {
    const original = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        title: {
          type: "string",
          minLength: 3,
          maxLength: 120,
        },
        links: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            format: "uri",
          },
        },
      },
      required: ["title", "links"],
      additionalProperties: false,
    };

    expect(parallelCompatibleOutputSchema(original)).toEqual({
      type: "object",
      properties: {
        title: { type: "string" },
        links: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["title", "links"],
      additionalProperties: false,
    });
    expect(original.properties.title.minLength).toBe(3);
  });

  it("makes the weekly-pack research schema compatible without weakening local validation", () => {
    const compatible = parallelCompatibleOutputSchema(
      z.toJSONSchema(weeklyPackResearchFindingSchema),
    );
    const serialized = JSON.stringify(compatible);

    expect(compatible.type).toBe("object");
    expect(serialized).not.toMatch(
      /"\$schema"|"format"|"minLength"|"maxLength"|"minItems"|"maxItems"/,
    );
    expect(() =>
      weeklyPackResearchFindingSchema.parse({
        cardId: "small",
      }),
    ).toThrow();
  });

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
    ).rejects.toMatchObject({
      name: "ParallelResearchError",
      message: "Parallel rejected the configured API key.",
      status: 401,
    });
  });

  it("surfaces insufficient Parallel credit without exposing request data", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(402, {
        type: "error",
        error: {
          ref_id: "parallel-ref-402",
          message: "Payment required: insufficient credit in account",
          detail: { input: "private research input" },
        },
      }),
    );

    const promise = startParallelResearch({
      input: "private research input",
      outputSchema: {},
    });
    await expect(promise).rejects.toMatchObject({
      message:
        "Parallel has insufficient account credit to start research. Add credit in Parallel Platform, then try again.",
      status: 402,
      referenceId: "parallel-ref-402",
    });
    await expect(promise).rejects.not.toThrow(/private research input/);
  });

  it("includes a safe provider validation message and reference id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        type: "error",
        error: {
          ref_id: "parallel-ref-422",
          message: "Request validation error.",
          detail: { input: "do not expose this value" },
        },
      }),
    );

    await expect(
      startParallelResearch({ input: "x", outputSchema: {} }),
    ).rejects.toMatchObject({
      message:
        "Parallel rejected the research request: Request validation error.",
      status: 422,
      referenceId: "parallel-ref-422",
    });
  });

  it("retries one explicit rate-limit rejection without duplicating other failures", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Too many requests: quota temporarily exceeded",
            },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "0",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(202, { run_id: "trun_after_retry", status: "queued" }),
      );

    await expect(
      startParallelResearch({ input: "x", outputSchema: {} }),
    ).resolves.toEqual({ runId: "trun_after_retry" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    fetchMock
      .mockResolvedValueOnce(jsonResponse(408, {}))
      .mockResolvedValueOnce(jsonResponse(408, {}));

    await expect(fetchParallelResearchResult("trun_1", 2)).resolves.toEqual({
      status: "pending",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a transient short-poll timeout", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(408, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          run: { run_id: "trun_1", status: "completed" },
          output: { type: "json", content: { ready: true } },
        }),
      );

    await expect(fetchParallelResearchResult("trun_1", 2)).resolves.toEqual({
      status: "completed",
      content: { ready: true },
      citations: [],
    });
  });

  it("serializes concurrent result reads", async () => {
    let activeRequests = 0;
    let peakActiveRequests = 0;
    fetchMock.mockImplementation(async () => {
      activeRequests += 1;
      peakActiveRequests = Math.max(peakActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeRequests -= 1;
      return jsonResponse(200, {
        run: { run_id: "trun_1", status: "running" },
      });
    });

    await Promise.all([
      fetchParallelResearchResult("trun_1", 2),
      fetchParallelResearchResult("trun_2", 2),
    ]);

    expect(peakActiveRequests).toBe(1);
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

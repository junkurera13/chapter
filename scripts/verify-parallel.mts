import { spawnSync } from "node:child_process";

if (!process.env.PARALLEL_API_KEY) {
  const result = spawnSync(
    "npx",
    ["convex", "env", "get", "PARALLEL_API_KEY"],
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const key = result.stdout.trim();
  if (result.status !== 0 || !key) {
    throw new Error(
      "PARALLEL_API_KEY is not configured. Create one at https://platform.parallel.ai and add it to the linked Convex development environment.",
    );
  }
  process.env.PARALLEL_API_KEY = key;
}

const { checkParallelResearch } = await import(
  "../agent/lib/parallel-search"
);
const research = await checkParallelResearch();

if (research.sources.length === 0) {
  throw new Error("Parallel connected but returned no grounded sources.");
}

console.log("Parallel research connected.");

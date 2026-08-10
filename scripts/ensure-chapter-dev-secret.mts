import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const current = spawnSync(
  "npx",
  ["convex", "env", "get", "CHAPTER_AGENT_SECRET"],
  { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);

if (current.status === 0 && current.stdout.trim()) {
  console.log("Chapter development secret is already configured.");
  process.exit(0);
}

const secret = randomBytes(32).toString("hex");
const saved = spawnSync(
  "npx",
  ["convex", "env", "set", "CHAPTER_AGENT_SECRET", secret],
  { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);

if (saved.status !== 0) {
  throw new Error("Could not configure CHAPTER_AGENT_SECRET in Convex development.");
}

console.log("Chapter development secret configured.");

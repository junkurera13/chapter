import { generateText } from "ai";
import { spawnSync } from "node:child_process";

if (!process.env.OPENROUTER_API_KEY) {
  const result = spawnSync(
    "npx",
    ["convex", "env", "get", "OPENROUTER_API_KEY"],
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const key = result.stdout.trim();
  if (result.status !== 0 || !key) {
    throw new Error("OPENROUTER_API_KEY is not configured for the app or linked Convex development deployment.");
  }
  process.env.OPENROUTER_API_KEY = key;
}

const { chapterConversationModel } = await import("../agent/lib/openrouter");

const result = await generateText({
  model: chapterConversationModel,
  prompt: "Reply with exactly the single word: connected",
  maxOutputTokens: 16,
});

if (result.text.trim().toLocaleLowerCase() !== "connected") {
  throw new Error(
    "OpenRouter responded, but the connection check returned an unexpected result.",
  );
}

console.log("OpenRouter connected.");

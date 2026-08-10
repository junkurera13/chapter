import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // CI and deployed checks provide environment variables directly.
}

const secret = process.env.CHAPTER_AGENT_SECRET;
const cloudUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const siteUrl =
  process.env.CONVEX_SITE_URL ??
  cloudUrl?.replace(/\.convex\.cloud$/, ".convex.site");

if (!secret || !siteUrl) {
  throw new Error("Chapter's Convex HTTP boundary is not configured.");
}

const response = await fetch(`${siteUrl.replace(/\/$/, "")}/chapter-agent`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${secret}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    operation: "get_context",
    externalPrincipalId: "chapter-development-health-check",
  }),
});

if (!response.ok) {
  throw new Error(`Chapter's Convex HTTP boundary returned ${response.status}.`);
}

const body = (await response.json()) as { onboardingStage?: unknown };
if (body.onboardingStage !== "needs_memory") {
  throw new Error("Chapter's Convex HTTP boundary returned an invalid context.");
}

console.log("Chapter Convex store connected.");

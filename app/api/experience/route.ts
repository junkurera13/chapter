import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";

import { api } from "@/convex/_generated/api";
import { researchChapterExperience } from "@/agent/lib/parallel-search";
import { hasChapterAccess } from "@/lib/chapter-access-server";
import { chapterExperienceSchema } from "@/lib/chapter/experience";
import { authenticatedConvexClient } from "@/lib/convexServerClient";

export const runtime = "nodejs";
export const maxDuration = 120;

type ExperienceRequest = {
  kind: "andy" | "marco";
  location: string;
  personalCue?: string;
  constraints?: string;
};

function isExperienceRequest(value: unknown): value is ExperienceRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Partial<ExperienceRequest>;
  return (
    (input.kind === "andy" || input.kind === "marco") &&
    typeof input.location === "string" &&
    input.location.trim().length >= 2 &&
    input.location.length <= 140 &&
    (input.personalCue === undefined || typeof input.personalCue === "string") &&
    (input.constraints === undefined || typeof input.constraints === "string")
  );
}

function compactResearch(research: Awaited<ReturnType<typeof researchChapterExperience>>) {
  return research.lanes.map((lane) => ({
    lane: lane.lane,
    status: lane.status,
    sources: lane.sources.slice(0, 8).map((source) => ({
      url: source.url,
      title: source.title,
      publishDate: source.publishDate,
      excerpts: source.excerpts.slice(0, 3).map((excerpt) => excerpt.slice(0, 700)),
    })),
  }));
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  if (!(await hasChapterAccess())) {
    return Response.json({ error: "Access required." }, { status: 403 });
  }
  const convex = await authenticatedConvexClient();
  if (!convex) {
    return Response.json({ error: "Your session expired." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isExperienceRequest(body)) {
    return Response.json({ error: "Choose a valid experience and location." }, { status: 400 });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: "Chapter's experience model is unavailable." }, { status: 503 });
  }

  const location = body.location.trim().replace(/\s+/g, " ");
  const personalCue = body.personalCue?.trim().slice(0, 500);
  const constraints = body.constraints?.trim().slice(0, 500);
  const requestText = [location, personalCue, constraints].filter(Boolean).join(" · ");

  try {
    const research = await researchChapterExperience(
      { kind: body.kind, location, personalCue, constraints },
      request.signal,
    );
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      compatibility: "strict",
      appName: "Chapter",
      appUrl: "https://usechapter.xyz",
      extraBody: {
        provider: {
          allow_fallbacks: true,
          data_collection: "deny",
          require_parameters: true,
          zdr: true,
        },
      },
    });
    const modelId = process.env.CHAPTER_EXPERIENCE_MODEL || "openai/gpt-5.6-luna";
    const duration = body.kind === "andy" ? "45 to 90 minutes" : "2 to 4 hours";
    const result = await generateText({
      model: openrouter(modelId),
      prompt: [
        `Create one confident, specific ${body.kind === "andy" ? "Andy" : "Marco"} experience in ${location}.`,
        `It must form a coherent solo outing lasting ${duration}, not a list of interchangeable recommendations.`,
        "Use only concrete place names and operational details supported by the supplied research. Never invent hours, prices, addresses, booking rules, or availability.",
        "When a practical detail is unavailable, say to confirm it directly instead of guessing.",
        "Prefer the distinctive local thread that best fits the person over famous attractions or generic tourism.",
        "Every source URL in the answer must appear in the supplied research. Use two to six of the strongest sources.",
        `The verifiedAt timestamp is ${new Date().toISOString()}.`,
        personalCue ? `Personal cue: ${personalCue}` : "",
        constraints ? `Constraints: ${constraints}` : "",
        "",
        "RESEARCH",
        JSON.stringify(compactResearch(research)),
      ].filter(Boolean).join("\n"),
      output: Output.object({
        name: "chapter_experience",
        description: "One researched, logistically useful Chapter experience.",
        schema: chapterExperienceSchema,
      }),
      reasoning: "none",
      temperature: 0.2,
      maxOutputTokens: 8_000,
      maxRetries: 1,
      timeout: { totalMs: 70_000 },
      abortSignal: request.signal,
    });
    const experience = chapterExperienceSchema.parse(result.output);
    const experienceId = await convex.mutation(api.webExperiences.saveGenerated, {
      kind: body.kind,
      requestText,
      experience,
    });
    return Response.json({ experienceId, experience });
  } catch (error) {
    console.error("[experience:route] request failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
    });
    return Response.json(
      { error: "Chapter couldn't shape that experience just now." },
      { status: 502 },
    );
  }
}

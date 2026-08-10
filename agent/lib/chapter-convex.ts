import type { ToolContext } from "eve/tools";
import { z } from "zod";

import type { Id } from "../../convex/_generated/dataModel";
import type { ChapterExperience } from "../../lib/chapter/experience";

const chapterContextSchema = z.object({
  onboardingStage: z.enum(["needs_memory", "needs_location", "complete"]),
  location: z
    .object({
      city: z.string(),
      area: z.string().nullable(),
      country: z.string().nullable(),
    })
    .nullable(),
  memories: z.array(
    z.object({ id: z.string(), text: z.string(), createdAt: z.number() }),
  ),
  recentExperiences: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["andy", "marco"]),
      title: z.string(),
      summary: z.string(),
      status: z.enum(["sent", "saved", "passed", "done"]),
      createdAt: z.number(),
    }),
  ),
});

const memoryResultSchema = z.object({
  memoryId: z.string(),
  onboardingStage: z.enum(["needs_location", "complete"]),
});

const locationResultSchema = z.object({
  onboardingStage: z.literal("complete"),
  city: z.string(),
  area: z.string().optional(),
  country: z.string().optional(),
});

const experienceResultSchema = z.object({
  experienceId: z.string(),
  status: z.enum(["sent", "saved", "passed", "done"]),
});

const feedbackResultSchema = z.object({
  feedbackId: z.string(),
  experienceId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  verdict: z.enum(["save", "pass", "done", "note"]),
});

function getConvexSiteUrl() {
  const explicit = process.env.CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const cloudUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (cloudUrl?.endsWith(".convex.cloud")) {
    return cloudUrl.replace(/\.convex\.cloud$/, ".convex.site");
  }
  throw new Error("CONVEX_SITE_URL is not configured for the Chapter agent.");
}

function getAgentSecret() {
  const secret = process.env.CHAPTER_AGENT_SECRET;
  if (!secret) throw new Error("CHAPTER_AGENT_SECRET is not configured.");
  return secret;
}

async function chapterRequest<T>(
  operation: string,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
) {
  const response = await fetch(`${getConvexSiteUrl()}/chapter-agent`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getAgentSecret()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ operation, ...body }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Chapter's memory store rejected the request (${response.status}).`);
  }
  return schema.parse(await response.json());
}

export function requireChapterPrincipal(ctx: ToolContext) {
  const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
  if (
    !auth ||
    auth.authenticator !== "chapter-imessage" ||
    auth.principalType !== "user"
  ) {
    throw new Error(
      "This Chapter action is only available in a trusted iMessage session.",
    );
  }
  return auth.principalId;
}

export function toolIdempotencyKey(ctx: ToolContext, principalId: string) {
  return `${principalId}:${ctx.session.turn.id}:${ctx.callId}`;
}

export async function getChapterContext(externalPrincipalId: string) {
  return await chapterRequest(
    "get_context",
    { externalPrincipalId },
    chapterContextSchema,
  );
}

export async function saveChapterMemory(args: {
  externalPrincipalId: string;
  idempotencyKey: string;
  text: string;
}) {
  return await chapterRequest("save_memory", args, memoryResultSchema);
}

export async function saveChapterLocation(args: {
  externalPrincipalId: string;
  city: string;
  area?: string;
  country?: string;
}) {
  return await chapterRequest("save_location", args, locationResultSchema);
}

export async function saveChapterExperience(args: {
  externalPrincipalId: string;
  idempotencyKey: string;
  requestText: string;
  experience: ChapterExperience;
}) {
  return await chapterRequest("save_experience", args, experienceResultSchema);
}

export async function saveChapterFeedback(args: {
  externalPrincipalId: string;
  idempotencyKey: string;
  experienceId?: Id<"chapterExperiences">;
  verdict: "save" | "pass" | "done" | "note";
  text?: string;
}) {
  return await chapterRequest("save_feedback", args, feedbackResultSchema);
}

export type ChapterAgentContext = Awaited<ReturnType<typeof getChapterContext>>;

export function formatChapterContext(context: ChapterAgentContext) {
  return JSON.stringify({
    chapterProfile: {
      onboardingStage: context.onboardingStage,
      location: context.location,
      memories: context.memories.map((memory) => ({
        id: memory.id,
        text: memory.text,
      })),
      recentExperiences: context.recentExperiences.map((experience) => ({
        id: experience.id,
        kind: experience.kind,
        title: experience.title,
        summary: experience.summary,
        status: experience.status,
      })),
    },
  });
}

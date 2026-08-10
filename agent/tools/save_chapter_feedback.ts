import { defineTool } from "eve/tools";
import { z } from "zod";

import type { Id } from "../../convex/_generated/dataModel";
import {
  requireChapterPrincipal,
  saveChapterFeedback,
  toolIdempotencyKey,
} from "../lib/chapter-convex";

export default defineTool({
  description:
    "Save a user's Save, Pass, Done, or free-text reaction to their latest or named Chapter experience.",
  inputSchema: z.object({
    verdict: z.enum(["save", "pass", "done", "note"]),
    experienceId: z.string().optional(),
    feedback: z.string().trim().min(1).max(2_000).optional(),
  }),
  async execute({ verdict, experienceId, feedback }, ctx) {
    const externalPrincipalId = requireChapterPrincipal(ctx);
    return await saveChapterFeedback({
      externalPrincipalId,
      idempotencyKey: toolIdempotencyKey(ctx, externalPrincipalId),
      experienceId: experienceId as Id<"chapterExperiences"> | undefined,
      verdict,
      text: feedback,
    });
  },
});

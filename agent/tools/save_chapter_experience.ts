import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  chapterExperienceSchema,
  formatExperienceForImessage,
} from "../../lib/chapter/experience";
import {
  requireChapterPrincipal,
  saveChapterExperience,
  toolIdempotencyKey,
} from "../lib/chapter-convex";

export default defineTool({
  description:
    "Validate and save one fully researched Andy or Marco, then return the exact concise iMessage to send.",
  inputSchema: z.object({
    requestText: z.string().trim().min(1).max(1_000),
    experience: chapterExperienceSchema,
  }),
  async execute({ requestText, experience }, ctx) {
    const externalPrincipalId = requireChapterPrincipal(ctx);
    const saved = await saveChapterExperience({
      externalPrincipalId,
      idempotencyKey: toolIdempotencyKey(ctx, externalPrincipalId),
      requestText,
      experience,
    });

    return {
      ...saved,
      imessageText: formatExperienceForImessage(experience),
    };
  },
});

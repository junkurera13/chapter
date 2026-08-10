import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  requireChapterPrincipal,
  saveChapterMemory,
  toolIdempotencyKey,
} from "../lib/chapter-convex";

export default defineTool({
  description:
    "Save one meaningful memory the user shared during Chapter onboarding or later conversation.",
  inputSchema: z.object({
    memory: z.string().trim().min(1).max(4_000),
  }),
  async execute({ memory }, ctx) {
    const externalPrincipalId = requireChapterPrincipal(ctx);
    return await saveChapterMemory({
      externalPrincipalId,
      idempotencyKey: toolIdempotencyKey(ctx, externalPrincipalId),
      text: memory,
    });
  },
});

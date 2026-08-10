import { defineTool } from "eve/tools";
import { z } from "zod";

import { verifyChapterLogistics } from "../lib/parallel-search";

export default defineTool({
  description:
    "Verify the exact current logistics for the one Chapter experience being composed. Call after choosing its places and before saving it.",
  inputSchema: z.object({
    location: z.string().trim().min(2).max(160),
    places: z.array(z.string().trim().min(2).max(160)).min(1).max(3),
    experiencePromise: z.string().trim().min(20).max(800),
    durationMinutes: z.number().int().min(45).max(240),
    claims: z.array(z.string().trim().min(2).max(240)).max(8).optional(),
  }),
  async execute(input, ctx) {
    return await verifyChapterLogistics(input, ctx.abortSignal);
  },
});

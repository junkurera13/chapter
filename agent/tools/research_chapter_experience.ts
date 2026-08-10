import { defineTool } from "eve/tools";
import { z } from "zod";

import { researchChapterExperience } from "../lib/parallel-search";

export default defineTool({
  description:
    "Run Chapter's three Parallel discovery lanes concurrently: local texture, lived social signals, and practical possibilities. Use once before designing an Andy or Marco.",
  inputSchema: z.object({
    kind: z.enum(["andy", "marco"]),
    location: z.string().trim().min(2).max(160),
    personalCue: z
      .string()
      .trim()
      .min(2)
      .max(240)
      .optional()
      .describe(
        "An abstract affinity inferred from memory, never a quote or private memory detail.",
      ),
    constraints: z.string().trim().min(2).max(500).optional(),
    localQueries: z
      .array(z.string().trim().min(3).max(200))
      .min(1)
      .max(3)
      .optional()
      .describe(
        "Short local-language discovery queries for neighborhood blogs and small cultural places, only when confident in the language.",
      ),
  }),
  async execute(input, ctx) {
    return await researchChapterExperience(input, ctx.abortSignal);
  },
});

import { defineTool } from "eve/tools";
import { z } from "zod";

import { researchWithOpenRouter } from "../lib/openrouter-search";

export default defineTool({
  description:
    "Research a current place or practical claim through OpenRouter web search and return cited findings.",
  inputSchema: z.object({
    query: z.string().trim().min(1).max(500),
  }),
  async execute({ query }, ctx) {
    return await researchWithOpenRouter(query, ctx.abortSignal);
  },
});

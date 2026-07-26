import { defineTool } from "eve/tools";
import { z } from "zod";

import { callerIdentity, completeMemory } from "../lib/base44";
import { memoryExtractionSchema } from "../../lib/memoryExtractionSchema";

export default defineTool({
  description:
    "Validate and durably persist a prepared autobiographical memory and its experience graph in Base44.",
  inputSchema: z.object({
    memoryId: z.string().min(1),
    extraction: memoryExtractionSchema,
  }),
  async execute(input, ctx) {
    const identity = callerIdentity(
      ctx.session.auth.current?.attributes || {},
    );
    return await completeMemory({
      ...identity,
      memoryId: input.memoryId,
      extraction: input.extraction,
    });
  },
});

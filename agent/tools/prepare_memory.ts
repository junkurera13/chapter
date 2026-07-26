import { defineTool } from "eve/tools";
import { z } from "zod";

import { callerIdentity, prepareMemory } from "../lib/base44";

export default defineTool({
  description:
    "Prepare a concrete autobiographical memory for grounded extraction and durable Base44 persistence.",
  inputSchema: z.object({
    text: z.string().min(1).max(6_000),
    source: z.enum(["onboarding", "reflection"]).default("reflection"),
  }),
  async execute(input, ctx) {
    const identity = callerIdentity(
      ctx.session.auth.current?.attributes || {},
    );
    const prepared = await prepareMemory({
      ...identity,
      clientRequestId: `eve:${ctx.callId}`,
      source: input.source,
      text: input.text,
      images: [],
    });
    return prepared.alreadyComplete
      ? {
          alreadyComplete: true,
          memoryId: prepared.memoryId,
          title: prepared.title,
          summary: prepared.summary,
        }
      : {
          alreadyComplete: false,
          memoryId: prepared.memoryId,
          extractionPrompt: prepared.prompt,
        };
  },
});

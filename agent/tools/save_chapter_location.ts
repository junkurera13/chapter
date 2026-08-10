import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  requireChapterPrincipal,
  saveChapterLocation,
} from "../lib/chapter-convex";

export default defineTool({
  description:
    "Save the user's home city and optional neighborhood after their first memory has been saved.",
  inputSchema: z.object({
    city: z.string().trim().min(1).max(100),
    area: z.string().trim().min(1).max(100).optional(),
    country: z.string().trim().min(1).max(100).optional(),
  }),
  async execute(location, ctx) {
    return await saveChapterLocation({
      externalPrincipalId: requireChapterPrincipal(ctx),
      ...location,
    });
  },
});

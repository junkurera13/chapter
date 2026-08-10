import { defineAgent } from "eve";

import {
  chapterConversationModel,
  chapterModelContextWindowTokens,
} from "./lib/openrouter";

export default defineAgent({
  model: chapterConversationModel,
  modelContextWindowTokens: chapterModelContextWindowTokens,
  reasoning: "low",
  compaction: {
    modelContextWindowTokens: chapterModelContextWindowTokens,
    thresholdPercent: 0.75,
  },
  limits: {
    maxInputTokensPerSession: 300_000,
    maxOutputTokensPerSession: 30_000,
  },
});

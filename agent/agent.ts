import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-5.4-mini",
  reasoning: "low",
  limits: {
    maxInputTokensPerSession: 200_000,
    maxOutputTokensPerSession: 20_000,
  },
});

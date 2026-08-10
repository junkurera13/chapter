import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const DEFAULT_CHAPTER_MODEL = "openai/gpt-5.6-luna";
const DEFAULT_CHAPTER_MODEL_CONTEXT_WINDOW = 1_050_000;

const chapterOpenRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: "Chapter",
  appUrl: "https://chapter.today",
  compatibility: "strict",
});

export const chapterConversationModelId =
  process.env.OPENROUTER_CONVERSATION_MODEL ?? DEFAULT_CHAPTER_MODEL;

const configuredContextWindow = process.env.OPENROUTER_MODEL_CONTEXT_WINDOW_TOKENS;
export const chapterModelContextWindowTokens = configuredContextWindow
  ? Number(configuredContextWindow)
  : chapterConversationModelId === DEFAULT_CHAPTER_MODEL
    ? DEFAULT_CHAPTER_MODEL_CONTEXT_WINDOW
    : (() => {
        throw new Error(
          "OPENROUTER_MODEL_CONTEXT_WINDOW_TOKENS is required when overriding Chapter's conversation model.",
        );
      })();

if (
  !Number.isSafeInteger(chapterModelContextWindowTokens) ||
  chapterModelContextWindowTokens < 32_000
) {
  throw new Error("OPENROUTER_MODEL_CONTEXT_WINDOW_TOKENS is invalid.");
}

export const chapterConversationModel = chapterOpenRouter(
  chapterConversationModelId,
);

import { generateText } from "ai";

import { chapterOpenRouter, chapterResearchModel } from "./openrouter";

export async function researchWithOpenRouter(
  query: string,
  abortSignal?: AbortSignal,
) {
  const result = await generateText({
    model: chapterResearchModel,
    tools: {
      web_search: chapterOpenRouter.tools.webSearch({
        engine: "exa",
        maxResults: 6,
      }),
    },
    prompt: [
      "Research the following request using the web search tool.",
      "Return concise factual findings, preserving exact venue names, addresses, current hours, prices, booking requirements, and source distinctions when available.",
      "Do not invent a missing detail. Make uncertainty explicit.",
      `Request: ${query}`,
    ].join("\n"),
    maxOutputTokens: 2_000,
    abortSignal,
  });

  return {
    findings: result.text,
    sources: result.sources
      .filter((source) => source.sourceType === "url")
      .map((source) => ({
        title: source.title ?? source.url,
        url: source.url,
      })),
  };
}

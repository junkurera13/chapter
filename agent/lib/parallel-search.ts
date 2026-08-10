import { randomUUID } from "node:crypto";

import { z } from "zod";

const parallelResultSchema = z
  .object({
    url: z.string().url(),
    title: z.string(),
    publish_date: z.string().nullable().optional(),
    excerpts: z.array(z.string()),
  })
  .passthrough();

const parallelSearchResponseSchema = z
  .object({
    search_id: z.string(),
    session_id: z.string(),
    results: z.array(parallelResultSchema),
    warnings: z.array(z.unknown()).nullable().optional(),
  })
  .passthrough();

type ParallelAdvancedSettings = {
  source_policy?: {
    include_domains?: string[];
    exclude_domains?: string[];
  };
  fetch_policy?: {
    max_age_seconds?: number;
    timeout_seconds?: number;
    disable_cache_fallback?: boolean;
  };
  excerpt_settings?: {
    max_chars_per_result: number;
  };
  max_results?: number;
};

type ParallelSearchInput = {
  objective: string;
  searchQueries: string[];
  sessionId?: string;
  maxCharsTotal?: number;
  advancedSettings?: ParallelAdvancedSettings;
};

function getParallelApiKey() {
  const apiKey = process.env.PARALLEL_API_KEY;
  if (!apiKey) {
    throw new Error("PARALLEL_API_KEY is not configured for Chapter research.");
  }
  return apiKey;
}

async function parallelSearch(
  input: ParallelSearchInput,
  abortSignal?: AbortSignal,
) {
  const response = await fetch("https://api.parallel.ai/v1/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": getParallelApiKey(),
    },
    body: JSON.stringify({
      objective: input.objective,
      search_queries: input.searchQueries,
      mode: "advanced",
      max_chars_total: input.maxCharsTotal ?? 12_000,
      session_id: input.sessionId,
      client_model:
        process.env.OPENROUTER_CONVERSATION_MODEL ?? "openai/gpt-5.6-luna",
      advanced_settings: input.advancedSettings,
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(`Parallel research failed (${response.status}).`);
  }

  const result = parallelSearchResponseSchema.parse(await response.json());
  return {
    searchId: result.search_id,
    sessionId: result.session_id,
    sources: result.results.map((source) => ({
      url: source.url,
      title: source.title,
      publishDate: source.publish_date ?? null,
      excerpts: source.excerpts,
    })),
    warnings: result.warnings ?? [],
  };
}

type ChapterResearchInput = {
  kind: "andy" | "marco";
  location: string;
  personalCue?: string;
  constraints?: string;
  localQueries?: string[];
};

const socialDomains = [
  "tiktok.com",
  "youtube.com",
  "reddit.com",
  "instagram.com",
];

const massMarketRecommendationDomains = [
  "tripadvisor.com",
  "trip.com",
  "agoda.com",
  "getyourguide.com",
  "klook.com",
  "trazy.com",
  "cityunscripted.com",
  "lokafy.com",
];

export async function researchChapterExperience(
  input: ChapterResearchInput,
  abortSignal?: AbortSignal,
) {
  const sessionId = `chapter_${randomUUID()}`;
  const duration = input.kind === "andy" ? "45 to 90 minutes" : "2 to 4 hours";
  const personalCue = input.personalCue
    ? `A subtle personal affinity to consider is: ${input.personalCue}.`
    : "";
  const constraints = input.constraints
    ? `The person's explicit constraints are: ${input.constraints}.`
    : "";

  const searches: Array<{
    lane: "local_texture" | "lived_signals" | "practical_possibilities";
    input: ParallelSearchInput;
  }> = [
    {
      lane: "local_texture",
      input: {
        sessionId,
        objective: [
          `Discover specific, non-obvious solo experiences in ${input.location} that could form a coherent ${duration} outing.`,
          "Prioritize local-language neighborhood blogs, independent magazines, newsletters, small cultural spaces, workshops, specialist shops, community pages, and details that reveal how locals actually use an area.",
          "Avoid generic tourism listicles, famous attractions, and recommendation roundups unless they reveal an unusual concrete detail.",
          personalCue,
          constraints,
        ]
          .filter(Boolean)
          .join(" "),
        searchQueries:
          input.localQueries?.length
            ? input.localQueries
            : [
                `${input.location} local hidden experiences`,
                `${input.location} neighborhood independent culture`,
                `${input.location} local blog unusual places`,
              ],
        advancedSettings: {
          source_policy: {
            exclude_domains: massMarketRecommendationDomains,
          },
          max_results: 10,
          excerpt_settings: { max_chars_per_result: 1_200 },
        },
      },
    },
    {
      lane: "lived_signals",
      input: {
        sessionId,
        objective: [
          `Find public first-person signals about specific things people genuinely enjoy doing alone in ${input.location}.`,
          "Prioritize original TikTok, YouTube, Reddit, and Instagram posts, captions, discussions, creator trails, and repeated small details over popularity rankings.",
          "Return original social URLs and preserve concrete place or activity names. Do not turn the evidence into a generic recommendation list.",
          personalCue,
          constraints,
        ]
          .filter(Boolean)
          .join(" "),
        searchQueries: [
          `${input.location} TikTok hidden local`,
          `${input.location} Reddit local favorite`,
          `${input.location} YouTube neighborhood walk`,
        ],
        advancedSettings: {
          source_policy: { include_domains: socialDomains },
          max_results: 10,
          excerpt_settings: { max_chars_per_result: 1_200 },
        },
      },
    },
    {
      lane: "practical_possibilities",
      input: {
        sessionId,
        objective: [
          `Find currently operating, specific places and bookable or walk-in activities in ${input.location} that could support a solo ${duration} experience.`,
          "Look for official venue pages alongside independent local coverage. Preserve exact names, addresses, hours, prices, booking rules, transit clues, and useful nearby pairings when the sources provide them.",
          "Prefer distinctive small places and time-sensitive possibilities over famous attractions.",
          constraints,
        ]
          .filter(Boolean)
          .join(" "),
        searchQueries: [
          `${input.location} workshops booking official`,
          `${input.location} independent venues hours`,
          `${input.location} unusual activities official`,
        ],
        advancedSettings: {
          source_policy: {
            exclude_domains: massMarketRecommendationDomains,
          },
          max_results: 10,
          excerpt_settings: { max_chars_per_result: 1_200 },
        },
      },
    },
  ];

  const settled = await Promise.allSettled(
    searches.map(async (search) => ({
      lane: search.lane,
      result: await parallelSearch(search.input, abortSignal),
    })),
  );

  const lanes = settled.map((result, index) => {
    const lane = searches[index].lane;
    if (result.status === "fulfilled") {
      return { lane, status: "complete" as const, ...result.value.result };
    }
    return {
      lane,
      status: "failed" as const,
      error: result.reason instanceof Error ? result.reason.message : "Research failed.",
      sources: [],
    };
  });

  if (lanes.every((lane) => lane.status === "failed")) {
    throw new Error("All Chapter research lanes failed.");
  }

  return { kind: input.kind, location: input.location, lanes };
}

type ChapterLogisticsInput = {
  location: string;
  places: string[];
  experiencePromise: string;
  durationMinutes: number;
  claims?: string[];
};

export async function verifyChapterLogistics(
  input: ChapterLogisticsInput,
  abortSignal?: AbortSignal,
) {
  const currentDate = new Date().toISOString().slice(0, 10);
  const claims = input.claims?.length
    ? `Verify these intended claims: ${input.claims.join("; ")}.`
    : "";

  return await parallelSearch(
    {
      objective: [
        `Prove whether this already-designed Chapter experience is executable as of ${currentDate}: ${input.experiencePromise}`,
        `The journey begins and ends near ${input.location}, uses ${input.places.join(", ")}, and must honestly fit within ${input.durationMinutes} minutes including travel and transitions.`,
        "Prefer each place's official website or booking page, then cross-check with a current independent source.",
        "Prove that each named place supports the intended participant action; a venue name or passive visit is not enough.",
        "Preserve exact addresses, opening hours, prices, reservation requirements, closures, age or equipment rules, accessibility, weather dependencies, safety constraints, and route-relevant facts.",
        "Make blocking conflicts or missing facts visible. Do not invent, infer, redesign, or replace the experience with an easier recommendation.",
        claims,
      ]
        .filter(Boolean)
        .join(" "),
      searchQueries: input.places.map(
        (place) => `${place} official current access`,
      ),
      maxCharsTotal: 16_000,
      advancedSettings: {
        source_policy: {
          exclude_domains: massMarketRecommendationDomains,
        },
        fetch_policy: {
          max_age_seconds: 86_400,
          timeout_seconds: 20,
        },
        max_results: 15,
        excerpt_settings: { max_chars_per_result: 1_500 },
      },
    },
    abortSignal,
  );
}

export async function checkParallelResearch(abortSignal?: AbortSignal) {
  return await parallelSearch(
    {
      objective:
        "Find the official Chapter product homepage solely to verify that Parallel Search is connected.",
      searchQueries: ["Chapter product official website"],
      maxCharsTotal: 2_000,
      advancedSettings: { max_results: 3 },
    },
    abortSignal,
  );
}

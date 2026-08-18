import { z } from "zod";

export const memoryNodeCategories = [
  "experience",
  "people",
  "place",
  "activity",
  "condition",
] as const;

export const memoryRelations = [
  "lived",
  "cares_about",
  "shared_with",
  "happened_at",
  "involved",
  "evoked",
  "shaped_by",
  "supported",
  "reflects",
  "part_of",
  "drawn_to",
  "familiar_with",
  "curious_about",
  "avoids",
  "requires",
  "reinforces",
  "contrasts_with",
  "discovered_through",
] as const;

const evidenceBasis = z.enum([
  "explicit",
  "visible",
  "inferred",
  "recurring",
]);

export const memoryExtractionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  nodes: z.array(
    z.object({
      local_key: z.string(),
      existing_key: z.string(),
      category: z.enum(memoryNodeCategories),
      subtype: z.string(),
      label: z.string(),
      description: z.string(),
      basis: evidenceBasis,
      confidence: z.number(),
      salience: z.number(),
      evidence: z.string(),
      source_refs: z.array(z.string()),
      prior_support_keys: z.array(z.string()),
    }),
  ),
  edges: z.array(
    z.object({
      from_key: z.string(),
      to_key: z.string(),
      relation: z.enum(memoryRelations),
      polarity: z.enum(["positive", "negative", "mixed", "neutral"]),
      familiarity: z.enum([
        "familiar",
        "new",
        "mixed",
        "not_applicable",
      ]),
      description: z.string(),
      basis: evidenceBasis,
      confidence: z.number(),
      evidence: z.string(),
      source_refs: z.array(z.string()),
    }),
  ),
});

export type MemoryExtraction = z.infer<typeof memoryExtractionSchema>;

import { createClientFromRequest } from "npm:@base44/sdk";

type QuestStop = {
  name: string;
  description: string;
  map_search: string;
  estimated_cost: string;
};

type QuestPayload = {
  title: string;
  brief: string;
  stops: QuestStop[];
  budget: string;
  invite_text: string;
  backup: string;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "brief", "stops", "budget", "invite_text", "backup"],
  properties: {
    title: { type: "string" },
    brief: { type: "string" },
    stops: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "map_search", "estimated_cost"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          map_search: { type: "string" },
          estimated_cost: { type: "string" },
        },
      },
    },
    budget: { type: "string" },
    invite_text: { type: "string" },
    backup: { type: "string" },
  },
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Quest field ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function validateQuest(value: unknown): QuestPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Base44 AI returned an invalid quest payload.");
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.stops) || candidate.stops.length !== 3) {
    throw new Error("Base44 AI must return exactly three stops.");
  }

  return {
    title: requiredString(candidate.title, "title"),
    brief: requiredString(candidate.brief, "brief"),
    stops: candidate.stops.map((rawStop, index) => {
      if (!rawStop || typeof rawStop !== "object") {
        throw new Error(`Quest stop ${index + 1} is invalid.`);
      }
      const stop = rawStop as Record<string, unknown>;
      return {
        name: requiredString(stop.name, `stops.${index}.name`),
        description: requiredString(stop.description, `stops.${index}.description`),
        map_search: requiredString(stop.map_search, `stops.${index}.map_search`),
        estimated_cost: requiredString(stop.estimated_cost, `stops.${index}.estimated_cost`),
      };
    }),
    budget: requiredString(candidate.budget, "budget"),
    invite_text: requiredString(candidate.invite_text, "invite_text"),
    backup: requiredString(candidate.backup, "backup"),
  };
}

function shortId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const input = (await req.json()) as Record<string, unknown>;
    const request = requiredString(input.request, "request");

    if (request.length < 8) {
      return Response.json({ error: "need a little more to go on." }, { status: 400 });
    }

    const country = typeof input.country === "string" ? input.country.trim() : "";
    const memory = typeof input.memorySummary === "string" ? input.memorySummary.trim() : "";
    const localContext = typeof input.localContext === "string" ? input.localContext.trim() : "";

    const prompt = [
      "you are sidequest. you assign real-world things to do to bored people over imessage.",
      "",
      "tone: lowercase, short, sounds like a high school friend texting. no caps, no exclamation marks, no corporate energy. no mission, case file, checkpoint, dispatch, or protocol language.",
      "",
      "hard rules:",
      "- every stop must name a specific real place that currently exists.",
      "- never ask the user to find, search for, or choose a generic category of place.",
      "- map_search must contain the specific place name plus neighborhood or city.",
      "- return exactly three distinct stops with different energy.",
      "- respect the user's location, mood, budget, group, timing, duration, mobility, dietary needs, weather, and other constraints.",
      "- prefer places supported by current web context; never invent opening hours, prices, or venue facts.",
      "",
      country ? `phone-country context: ${country}` : "phone-country context: unknown",
      localContext ? `local context: ${localContext}` : "local context: none",
      memory ? `what we know about this user: ${memory}` : "we have no prior memory of this user.",
      "",
      `user said: ${request}`,
      "",
      "research specific real places and return the complete sidequest in the requested JSON shape.",
    ].join("\n");

    const generated = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: responseSchema,
    });

    const quest = validateQuest(generated);
    const id = shortId();
    const source =
      input.source === "imessage" || input.source === "terminal"
        ? input.source
        : "admin";

    await base44.asServiceRole.entities.Quest.create({
      short_id: id,
      request,
      phone: typeof input.phone === "string" ? input.phone : undefined,
      initial_request:
        typeof input.initialRequest === "string" ? input.initialRequest : undefined,
      followup_answer:
        typeof input.followupAnswer === "string" ? input.followupAnswer : undefined,
      source,
      ...quest,
      created_at: Date.now(),
    });

    return Response.json({ id, url: `/q/${id}`, title: quest.title });
  } catch (error) {
    const message = error instanceof Error ? error.message : "mission printer jammed. try again.";
    console.error("generate-quest failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
});

export type QuestStop = {
  name: string;
  description: string;
  mapSearch: string;
  estimatedCost: string;
};

export type QuestPayload = {
  title: string;
  brief: string;
  stops: QuestStop[];
  budget: string;
  inviteText: string;
  backup: string;
};

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Quest field "${field}" must be a non-empty string.`);
  }

  return value.trim();
}

export function validateQuestPayload(value: unknown): QuestPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Quest payload must be an object.");
  }

  const payload = value as Record<string, unknown>;
  const stops = payload.stops;

  if (!Array.isArray(stops) || stops.length !== 3) {
    throw new Error("Quest must include exactly three stops.");
  }

  return {
    title: requireString(payload.title, "title"),
    brief: requireString(payload.brief, "brief"),
    stops: stops.map((stop, index) => {
      if (!stop || typeof stop !== "object") {
        throw new Error(`Quest stop ${index + 1} must be an object.`);
      }

      const stopPayload = stop as Record<string, unknown>;

      return {
        name: requireString(stopPayload.name, `stops.${index}.name`),
        description: requireString(
          stopPayload.description,
          `stops.${index}.description`,
        ),
        mapSearch: requireString(
          stopPayload.mapSearch,
          `stops.${index}.mapSearch`,
        ),
        estimatedCost: requireString(
          stopPayload.estimatedCost,
          `stops.${index}.estimatedCost`,
        ),
      };
    }),
    budget: requireString(payload.budget, "budget"),
    inviteText: requireString(payload.inviteText, "inviteText"),
    backup: requireString(payload.backup, "backup"),
  };
}

export function buildMapSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query,
  )}`;
}

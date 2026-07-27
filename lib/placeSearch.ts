/**
 * Place lookup for the Now home-city ask.
 *
 * Chapter's deep research is only as good as the area it's pointed at: "Seoul"
 * covers ten million people, "Seocho, Seoul" is a neighbourhood you can walk.
 * So the suggestions are drawn from Photon (an OpenStreetMap geocoder built for
 * type-ahead, no API key) and ranked so districts land above whole cities.
 */

const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";

export type PlaceSuggestion = {
  /** Stable key for lists — Photon's OSM identity. */
  id: string;
  /** What gets saved as the home city, e.g. "Seocho, Seoul, South Korea". */
  label: string;
  /** Leading part of the label, shown large in the list. */
  name: string;
  /** The rest of the label — "Seoul, South Korea". */
  context: string;
  /** True when the place is a whole city or larger: worth narrowing down. */
  broad: boolean;
  latitude: number;
  longitude: number;
};

export class PlaceSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaceSearchError";
  }
}

/** Photon place types worth offering: a neighbourhood up to a whole country. */
const PRECISE_TYPES: readonly string[] = ["district", "locality"];
/** Types too coarse to research in — picking one starts a narrowing round. */
const BROAD_TYPES: readonly string[] = ["city", "county", "state", "country"];

type PhotonProperties = {
  osm_type?: string;
  osm_id?: number;
  osm_key?: string;
  type?: string;
  name?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
};

type PhotonFeature = {
  properties?: PhotonProperties;
  geometry?: { coordinates?: unknown };
};

function coordinates(feature: PhotonFeature) {
  const pair = feature.geometry?.coordinates;
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const [longitude, latitude] = pair;
  if (typeof longitude !== "number" || typeof latitude !== "number") return null;
  return { latitude, longitude };
}

/** Turns one Photon feature into a suggestion, or null if it isn't a place. */
export function toSuggestion(feature: PhotonFeature): PlaceSuggestion | null {
  const properties = feature.properties ?? {};
  const type = properties.type ?? "";
  const name = (properties.name ?? "").trim();
  if (!name || properties.osm_key !== "place") return null;
  if (!PRECISE_TYPES.includes(type) && !BROAD_TYPES.includes(type)) return null;

  const point = coordinates(feature);
  if (!point) return null;

  const context = [
    properties.city,
    properties.county,
    properties.state,
    properties.country,
  ]
    .map((part) => (part ?? "").trim())
    .filter((part) => part && part !== name)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .slice(0, 2)
    .join(", ");

  return {
    id: `${properties.osm_type ?? "?"}${properties.osm_id ?? name}`,
    label: context ? `${name}, ${context}` : name,
    name,
    context,
    broad: BROAD_TYPES.includes(type),
    ...point,
  };
}

/**
 * Keeps the places out of a Photon response, in the order it returned them —
 * its relevance ordering already weighs importance, and re-sorting by
 * specificity floats obscure hamlets above the city you meant. Duplicate
 * labels are dropped, since one district often comes back as several OSM
 * objects.
 */
export function collectSuggestions(
  features: readonly PhotonFeature[],
  limit = 6,
): PlaceSuggestion[] {
  const seen = new Set<string>();
  const results: PlaceSuggestion[] = [];
  for (const feature of features) {
    const suggestion = toSuggestion(feature);
    if (!suggestion) continue;
    const key = suggestion.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(suggestion);
    if (results.length >= limit) break;
  }
  return results;
}

/**
 * Searches Photon for places matching `query`. When `near` is given the search
 * is biased to that point, which is how narrowing works: after someone picks
 * Seoul, typing "gang" offers Gangnam rather than a Gang somewhere else.
 */
export async function searchPlaces(
  query: string,
  options: {
    near?: { latitude: number; longitude: number };
    signal?: AbortSignal;
  } = {},
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(PHOTON_ENDPOINT);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", "18");
  url.searchParams.set("lang", "en");
  url.searchParams.set("osm_tag", "place");
  if (options.near) {
    url.searchParams.set("lat", `${options.near.latitude}`);
    url.searchParams.set("lon", `${options.near.longitude}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: options.signal,
      headers: { Accept: "application/json", "User-Agent": "Chapter/1.0" },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PlaceSearchError("Place search is unreachable.");
  }
  if (!response.ok) {
    throw new PlaceSearchError(`Place search failed (${response.status}).`);
  }

  const payload = (await response.json().catch(() => null)) as {
    features?: unknown;
  } | null;
  const features = Array.isArray(payload?.features)
    ? (payload.features as PhotonFeature[])
    : [];
  return collectSuggestions(features);
}

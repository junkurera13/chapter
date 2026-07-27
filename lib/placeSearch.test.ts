import { describe, expect, it } from "vitest";

import { collectSuggestions, toSuggestion } from "./placeSearch";

function feature(properties: Record<string, unknown>, lon = 127, lat = 37.5) {
  return { properties, geometry: { coordinates: [lon, lat] } };
}

describe("toSuggestion", () => {
  it("labels a district with its city and country", () => {
    const suggestion = toSuggestion(
      feature({
        osm_type: "R",
        osm_id: 2414779,
        osm_key: "place",
        type: "district",
        name: "Seocho",
        city: "Seoul",
        country: "South Korea",
      }),
    );

    expect(suggestion).toMatchObject({
      label: "Seocho, Seoul, South Korea",
      name: "Seocho",
      context: "Seoul, South Korea",
      broad: false,
    });
  });

  it("marks a whole city as broad", () => {
    expect(
      toSuggestion(
        feature({
          osm_key: "place",
          type: "city",
          name: "Seoul",
          country: "South Korea",
        }),
      ),
    ).toMatchObject({ label: "Seoul, South Korea", broad: true });
  });

  it("drops results that aren’t places", () => {
    expect(
      toSuggestion(
        feature({
          osm_key: "railway",
          type: "house",
          name: "Seoul Station",
          city: "Seoul",
        }),
      ),
    ).toBeNull();
  });

  it("drops places with no coordinates", () => {
    expect(
      toSuggestion({
        properties: { osm_key: "place", type: "city", name: "Seoul" },
      }),
    ).toBeNull();
  });
});

describe("collectSuggestions", () => {
  it("keeps the geocoder’s own relevance order and drops non-places", () => {
    const collected = collectSuggestions([
      feature({ osm_key: "place", type: "city", name: "Seoul", country: "South Korea" }),
      feature({ osm_key: "railway", type: "house", name: "Seoul Station", city: "Seoul" }),
      feature({
        osm_key: "place",
        type: "district",
        name: "Seocho",
        city: "Seoul",
        country: "South Korea",
      }),
    ]);

    expect(collected.map((place) => place.name)).toEqual(["Seoul", "Seocho"]);
  });

  it("keeps one row per label and honours the limit", () => {
    const duplicate = {
      osm_key: "place",
      type: "district",
      name: "Seocho",
      city: "Seoul",
      country: "South Korea",
    };
    const collected = collectSuggestions(
      [
        feature({ ...duplicate, osm_id: 1 }),
        feature({ ...duplicate, osm_id: 2 }),
        feature({ osm_key: "place", type: "district", name: "Gangnam", city: "Seoul" }),
      ],
      2,
    );

    expect(collected.map((place) => place.name)).toEqual(["Seocho", "Gangnam"]);
  });
});

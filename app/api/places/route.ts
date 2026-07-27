import { searchPlaces } from "@/lib/placeSearch";

export const runtime = "nodejs";

/**
 * Type-ahead place suggestions for the Now home-city ask. Proxied rather than
 * called from the browser so the upstream geocoder sees one identified caller,
 * and so a signed-out page can't use it as an open relay.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json(
      { error: "Your session expired. Sign in again.", code: "AUTHENTICATION_REQUIRED" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").slice(0, 120);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lon"));
  const near =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : undefined;

  try {
    const places = await searchPlaces(query, { near });
    return Response.json(
      { value: { places } },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error("[places:route] search failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        error: "Chapter couldn’t look that place up.",
        code: "PLACE_SEARCH_FAILED",
      },
      { status: 502 },
    );
  }
}

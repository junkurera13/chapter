import { parsePhoneNumberFromString } from "libphonenumber-js";

import { upsertUserByPhone } from "@/lib/base44Functions";
import { clientIpFromHeaders, lookupIpGeo } from "@/lib/ipGeo";
import { createSharedPhotonUser, PhotonSignupError } from "@/lib/photonSignup";

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function countryFromParsedPhone(region: string | undefined) {
  if (!region) return undefined;
  try {
    return COUNTRY_NAMES.of(region) ?? region;
  } catch {
    return region;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const phone =
    body && typeof body === "object" && "phone" in body
      ? (body as { phone: unknown }).phone
      : undefined;

  if (typeof phone !== "string" || phone.trim().length === 0) {
    return Response.json({ error: "phone required" }, { status: 400 });
  }

  const parsed = parsePhoneNumberFromString(phone.trim(), "US");
  if (!parsed?.isValid()) {
    return Response.json(
      { error: "that doesnt look like a valid phone number" },
      { status: 400 },
    );
  }

  const e164 = parsed.format("E.164");
  const country = countryFromParsedPhone(parsed.country);

  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;

  if (!projectId || !projectSecret) {
    console.error("missing PHOTON_PROJECT_ID or PHOTON_PROJECT_SECRET");
    return Response.json(
      { error: "server isn't configured. try again later." },
      { status: 500 },
    );
  }

  let assigned: string;
  try {
    assigned = await createSharedPhotonUser({
      projectId,
      projectSecret,
      phoneNumber: e164,
    });
  } catch (cause) {
    if (cause instanceof PhotonSignupError) {
      console.error("photon signup failed:", cause.status, cause.body);
      return Response.json(
        {
          error:
            cause.status === 429
              ? "line setup is busy rn. wait a few sec and try again."
              : `couldnt set up your sidequest line (${cause.status}${
                  cause.message ? `: ${cause.message}` : ""
                }).`,
          photonStatus: cause.status,
          photonMessage: cause.message,
        },
        { status: 502 },
      );
    }

    console.error("photon signup network error:", cause);
    return Response.json(
      { error: "couldnt reach the messaging service. try again." },
      { status: 502 },
    );
  }

  // Silently resolve a rough city from the requester's IP. This is the
  // "magic moment" — the agent later acts as if it knows where they are
  // without ever having asked. Best-effort, no permission prompt.
  const ip = clientIpFromHeaders(request.headers);
  const geo = ip ? await lookupIpGeo(ip) : undefined;

  // Create / update the Base44 user record. Best-effort: if it fails the
  // user can still text the agent and we'll create them on first message.
  try {
    await upsertUserByPhone({
      phone: e164,
      country,
      currentCity: geo?.city,
      latitude: geo?.latitude,
      longitude: geo?.longitude,
      assignedPhone: assigned,
      signedUpAt: Date.now(),
    });
  } catch (cause) {
    console.error("Base44 upsert during signup failed:", cause);
  }

  return Response.json({ assignedPhone: assigned });
}

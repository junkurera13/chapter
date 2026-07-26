import { parsePhoneNumberFromString } from "libphonenumber-js";

import {
  Base44FunctionError,
  connectMyPhone,
} from "@/lib/base44Functions";
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
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    return Response.json({ error: "Sign in before connecting a phone." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const phone =
    body && typeof body === "object" && "phone" in body
      ? (body as { phone: unknown }).phone
      : undefined;

  if (typeof phone !== "string" || phone.trim().length === 0) {
    return Response.json({ error: "Phone required." }, { status: 400 });
  }

  const parsed = parsePhoneNumberFromString(phone.trim(), "US");
  if (!parsed?.isValid()) {
    return Response.json(
      { error: "That doesn’t look like a valid phone number." },
      { status: 400 },
    );
  }

  const e164 = parsed.format("E.164");
  const country = countryFromParsedPhone(parsed.country);

  const ip = clientIpFromHeaders(request.headers);
  const geo = ip ? await lookupIpGeo(ip) : undefined;

  try {
    await connectMyPhone(
      {
        phone: e164,
        country,
        currentCity: geo?.city,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
      },
      accessToken,
    );
  } catch (cause) {
    if (cause instanceof Base44FunctionError) {
      return Response.json(
        { error: cause.message },
        { status: cause.status === 401 || cause.status === 409 ? cause.status : 502 },
      );
    }
    console.error("Base44 phone connection failed:", cause);
    return Response.json({ error: "Couldn’t connect your account. Try again." }, { status: 502 });
  }

  const projectId =
    process.env.IMESSAGE_PROJECT_ID ?? process.env.PHOTON_PROJECT_ID;
  const projectSecret =
    process.env.IMESSAGE_PROJECT_SECRET ?? process.env.PHOTON_PROJECT_SECRET;

  if (!projectId || !projectSecret) {
    console.error("missing IMESSAGE_PROJECT_ID or IMESSAGE_PROJECT_SECRET");
    return Response.json(
      { error: "The server isn’t configured. Try again later." },
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
              ? "Line setup is busy right now. Wait a few seconds and try again."
              : `Couldn’t set up your Chapter line (${cause.status}${
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
      { error: "Couldn’t reach the messaging service. Try again." },
      { status: 502 },
    );
  }

  try {
    const connected = await connectMyPhone(
      {
        phone: e164,
        country,
        currentCity: geo?.city,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        assignedPhone: assigned,
        signedUpAt: Date.now(),
      },
      accessToken,
    );

    return Response.json({ assignedPhone: assigned, viewer: connected.viewer });
  } catch (cause) {
    console.error("Base44 final phone connection failed:", cause);
    return Response.json(
      { error: "Your line was created, but the account link failed. Try again." },
      { status: 502 },
    );
  }
}

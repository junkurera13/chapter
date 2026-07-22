// Best-effort IP geolocation. We use ipapi.co's free tier (no key required,
// generous quota) to silently resolve a city at signup. Anything other than
// a clean city string returns undefined — the caller should treat this as
// purely additive context.

export type IpGeo = {
  city?: string;
  region?: string;
  countryCode?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
};

const PRIVATE_IP_PREFIXES = [
  "10.",
  "127.",
  "192.168.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
];

function isLookupable(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip === "0.0.0.0") return false;
  return !PRIVATE_IP_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

// Vercel sets x-forwarded-for to a comma-separated chain; the first entry is
// the client's apparent IP.
export function clientIpFromHeaders(headers: Headers): string | undefined {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? undefined;
}

export async function lookupIpGeo(ip: string): Promise<IpGeo | undefined> {
  if (!isLookupable(ip)) return undefined;

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: {
        // ipapi.co rate-limits anonymous requests harshly — UA helps.
        "User-Agent": "sidequest-signup/1.0",
      },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      city?: string;
      region?: string;
      country_code?: string;
      timezone?: string;
      latitude?: number;
      longitude?: number;
      error?: boolean;
    };
    if (data.error) return undefined;
    return {
      city: data.city?.trim() || undefined,
      region: data.region?.trim() || undefined,
      countryCode: data.country_code?.trim() || undefined,
      timezone: data.timezone?.trim() || undefined,
      latitude:
        typeof data.latitude === "number" ? data.latitude : undefined,
      longitude:
        typeof data.longitude === "number" ? data.longitude : undefined,
    };
  } catch {
    return undefined;
  }
}

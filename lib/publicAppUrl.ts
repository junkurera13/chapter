const PRODUCTION_APP_ORIGIN = "https://sidequest-b44.vercel.app";

export function publicInviteUrl(token: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  const origin = configuredOrigin || PRODUCTION_APP_ORIGIN;
  return new URL(`/invite/${encodeURIComponent(token)}`, origin).toString();
}

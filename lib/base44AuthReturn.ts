export const BASE44_AUTH_RETURN_COOKIE = "sidequest_auth_return";

const PRODUCTION_APP_ORIGIN = "https://usechapter.vercel.app";
const LOCAL_AUTH_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function safeBase44AuthReturnOrigin(requestUrl: string) {
  try {
    const requestOrigin = new URL(requestUrl).origin;
    return LOCAL_AUTH_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : PRODUCTION_APP_ORIGIN;
  } catch {
    return PRODUCTION_APP_ORIGIN;
  }
}

export function safeBase44AuthReturnPath(value: string | undefined) {
  return value && /^\/invite\/[A-Za-z0-9_-]{40,100}$/.test(value)
    ? value
    : null;
}

export function rememberBase44AuthReturnPath(path: string) {
  const safePath = safeBase44AuthReturnPath(path);
  if (!safePath || typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${BASE44_AUTH_RETURN_COOKIE}=${encodeURIComponent(safePath)}; Max-Age=600; Path=/; SameSite=Lax${secure}`;
}

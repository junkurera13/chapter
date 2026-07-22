export const BASE44_AUTH_RETURN_COOKIE = "sidequest_auth_return";

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

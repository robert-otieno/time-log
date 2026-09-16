export const SESSION_COOKIE_NAME = "time_log_session";
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
export const RECENT_SIGN_IN_SECONDS = 5 * 60;

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || /[\u0000-\u001F\u007F]/.test(value)) return "/";

  try {
    const parsed = new URL(value, "https://time-log.local");
    if (parsed.origin !== "https://time-log.local") return "/";
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.pathname === "/login" ? "/" : path;
  } catch {
    return "/";
  }
}

export function isRecentSignIn(
  authTimeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const age = nowSeconds - authTimeSeconds;
  return age >= 0 && age <= RECENT_SIGN_IN_SECONDS;
}

export function isSameOriginJsonRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return origin === new URL(request.url).origin && contentType.startsWith("application/json");
}

/** Route rules shared by the session proxy, the layouts and the auth actions. */

export const PROTECTED_PREFIXES = [
  "/onboarding",
  "/offers",
  "/applications",
  "/credits",
  "/account",
  "/forfait",
] as const;
export const AUTH_PAGES = ["/login", "/signup"] as const;
export const DEFAULT_AFTER_LOGIN = "/offers";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((page) => page === pathname);
}

/** Only same-origin relative paths may be used as post-login destinations (no open redirect). */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

/**
 * Base URL for auth redirects: the site the visitor is on (the Origin header of the form
 * post, checked by Next.js for server actions), else the configured site URL. Supabase
 * still accepts only the redirect URLs listed in the project.
 */
export function authRedirectBase(origin: string | null, siteUrl: string): string {
  if (origin && /^https?:\/\/[^/\s]+$/.test(origin)) return origin;
  return siteUrl.replace(/\/+$/, "");
}

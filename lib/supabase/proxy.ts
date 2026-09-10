import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_AFTER_LOGIN, isAuthPage, isProtectedPath } from "@/lib/auth/routes";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

function redirectTo(
  request: NextRequest,
  pathname: string,
  options: { from?: NextResponse; next?: string } = {},
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (options.next) url.searchParams.set("next", options.next);
  const response = NextResponse.redirect(url);
  // Keep the cookies Supabase just refreshed, or browser and server sessions drift apart.
  options.from?.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

/**
 * Refreshes the Supabase session on every request and keeps signed-out visitors
 * away from the app. Layouts and server code check authorisation again: the proxy
 * is never the only guard.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const next = `${pathname}${search}`;

  if (!isSupabaseConfigured()) {
    return isProtectedPath(pathname)
      ? redirectTo(request, "/login", { next })
      : NextResponse.next({ request });
  }

  const env = getPublicEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Nothing may run between createServerClient and getClaims (Supabase guidance).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && isProtectedPath(pathname)) {
    return redirectTo(request, "/login", { from: response, next });
  }
  if (signedIn && isAuthPage(pathname)) {
    return redirectTo(request, DEFAULT_AFTER_LOGIN, { from: response });
  }
  return response;
}

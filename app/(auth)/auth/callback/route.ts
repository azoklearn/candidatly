import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/routes";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { applyDraftAfterAuth } from "@/lib/onboarding/apply-draft";
import { createClient } from "@/lib/supabase/server";

/** OAuth (Google) and PKCE email links land here with a one-time code. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger.warn("auth_callback_failed", { code: error.code });
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }
  // Answers given before the account existed land on the profile (docs/QUESTIONS.md C91).
  const fromDraft = data.user ? await applyDraftAfterAuth(supabase, data.user.id) : null;
  return NextResponse.redirect(new URL(fromDraft ?? next, origin));
}

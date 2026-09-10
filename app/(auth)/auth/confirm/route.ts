import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { safeNextPath } from "@/lib/auth/routes";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const OtpTypeSchema = z.enum([
  "email",
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
]);

/** Email links built with {{ .TokenHash }} (supabase/templates/confirmation.html). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = OtpTypeSchema.safeParse(searchParams.get("type"));
  const next = safeNextPath(searchParams.get("next"), "/onboarding/1");

  if (!tokenHash || !type.success || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=confirm", origin));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
  if (error) {
    logger.warn("auth_confirm_failed", { code: error.code });
    return NextResponse.redirect(new URL("/login?error=confirm", origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}

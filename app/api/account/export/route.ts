import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { allowAction } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/** Data portability (brief section 5.7, GDPR article 20): everything the student gave or produced. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await allowAction(supabase, "export_data"))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const [profile, documents, applications, matches, credits, transactions, events] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("documents")
        .select(
          "kind, original_filename, mime_type, size_bytes, is_current, extracted_text, created_at",
        )
        .eq("user_id", userId),
      supabase
        .from("applications")
        .select(
          "status, cover_letter_text, sent_at, sent_via, next_follow_up_at, notes, created_at, updated_at, offer:offers(title, company_name, location_label)",
        )
        .eq("user_id", userId),
      supabase
        .from("matches")
        .select("status, score, created_at, offer:offers(title, company_name)")
        .eq("user_id", userId),
      supabase.from("credits").select("balance").eq("user_id", userId).maybeSingle(),
      supabase
        .from("credit_transactions")
        .select("delta, reason, created_at")
        .eq("user_id", userId),
      supabase.from("events").select("type, payload, created_at").eq("user_id", userId),
    ]);
  const failed = [profile, documents, applications, matches, credits, transactions, events].find(
    (r) => r.error,
  );
  if (failed?.error) {
    logger.error("export_failed", { area: "account", code: failed.error.code });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
  const exportedAt = new Date().toISOString();
  const body = {
    exported_at: exportedAt,
    account: { email: typeof auth.claims.email === "string" ? auth.claims.email : null },
    profile: profile.data,
    documents: documents.data,
    applications: applications.data,
    matches: matches.data,
    credits: credits.data,
    credit_transactions: transactions.data,
    events: events.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidatly-mes-donnees-${exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

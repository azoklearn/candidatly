import "server-only";

import { DatabaseError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Everything about one account for /admin/comptes/[id] (C112), read with the service key.
 * Documents come without their content: the file name, its size and its date are enough
 * to help a student, and the CV itself stays private.
 */

const LIST_LIMIT = 50;

function check<T>(operation: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new DatabaseError(operation, result.error);
  return result.data;
}

function list<T>(
  operation: string,
  result: { data: T[] | null; error: { message: string } | null },
): T[] {
  return check(operation, result) ?? [];
}

export async function loadAdminAccount(userId: string) {
  const db = createAdminClient();
  const [profile, subscriptions, documents, matches, matchCounts, applications, credits, events] =
    await Promise.all([
      db
        .from("profiles")
        .select(
          "user_id, email, first_name, last_name, phone, school, degree_label, diploma_level, target_contract, domain_free_text, rome_codes, location_label, search_radius_km, contract_chosen_at, onboarding_completed, chosen_plan, chosen_billing, plan_chosen_at, billing_exempt, created_at, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("subscriptions")
        .select(
          "provider, plan, billing, status, current_period_end, cancel_at_period_end, created_at, updated_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      db
        .from("documents")
        .select("kind, original_filename, mime_type, size_bytes, is_current, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT),
      db
        .from("matches")
        .select(
          "score, status, created_at, offer:offers!inner(title, company_name, location_label, published_at, removed_at)",
        )
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .limit(20),
      db.from("matches").select("status").eq("user_id", userId).limit(5000),
      db
        .from("applications")
        .select(
          "status, sent_at, sent_via, next_follow_up_at, regeneration_count, created_at, offer:offers(title, company_name, location_label)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT),
      db.from("credits").select("balance").eq("user_id", userId).maybeSingle(),
      db
        .from("events")
        .select("type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const row = check("admin.account.profile", profile);
  if (!row) return null;
  const romeCodes = row.rome_codes ?? [];
  const jobs =
    romeCodes.length > 0
      ? list(
          "admin.account.rome",
          await db.from("rome_codes").select("code, label").in("code", romeCodes),
        )
      : [];
  const auth = await db.auth.admin.getUserById(userId);
  const matchStatuses: Record<string, number> = {};
  for (const item of list("admin.account.match_counts", matchCounts)) {
    matchStatuses[item.status] = (matchStatuses[item.status] ?? 0) + 1;
  }

  return {
    profile: row,
    jobs,
    subscriptions: list("admin.account.subscriptions", subscriptions),
    documents: list("admin.account.documents", documents),
    topMatches: list("admin.account.matches", matches),
    matchStatuses,
    applications: list("admin.account.applications", applications),
    credits: check("admin.account.credits", credits)?.balance ?? null,
    lastSignInAt: auth.data.user?.last_sign_in_at ?? null,
    events: list("admin.account.events", events),
  };
}

export type AdminAccount = NonNullable<Awaited<ReturnType<typeof loadAdminAccount>>>;

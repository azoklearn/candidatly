import { DatabaseError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

import type { ApplicationRow, ProfileRow, SubscriptionRow } from "./overview";

/**
 * Everything /admin reads, with the service key (RLS off). The caller checks that the
 * visitor is an administrator first. Rows are capped: past these sizes the figures
 * should move to SQL aggregates.
 */

const PROFILE_LIMIT = 1000;
const APPLICATION_LIMIT = 5000;
const EVENT_LIMIT = 10;

export type BillingEventRow = {
  event_id: string;
  provider: string;
  type: string;
  created_at: string;
  processed_at: string | null;
};

export type SearchRunRow = {
  query_key: string;
  source: string;
  fetched_at: string;
  result_count: number | null;
  status_code: number | null;
};

export type AdminData = {
  profiles: ProfileRow[];
  subscriptions: SubscriptionRow[];
  applications: ApplicationRow[];
  liveOffers: number;
  matches: number;
  hiringCompanies: number;
  billingEvents: BillingEventRow[];
  searchRuns: SearchRunRow[];
  truncated: boolean;
};

function rowsOrThrow<T>(
  operation: string,
  result: { data: T[] | null; error: { message: string; code?: string } | null },
): T[] {
  if (result.error) throw new DatabaseError(operation, result.error);
  return result.data ?? [];
}

function countOrThrow(
  operation: string,
  result: { count: number | null; error: { message: string; code?: string } | null },
): number {
  if (result.error) throw new DatabaseError(operation, result.error);
  return result.count ?? 0;
}

export async function loadAdminData(): Promise<AdminData> {
  const supabase = createAdminClient();
  const [
    profiles,
    subscriptions,
    applications,
    liveOffers,
    matches,
    hiringCompanies,
    billingEvents,
    searchRuns,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "user_id, email, first_name, last_name, created_at, onboarding_completed, chosen_plan, chosen_billing, billing_exempt, location_label",
      )
      .order("created_at", { ascending: false })
      .limit(PROFILE_LIMIT),
    supabase
      .from("subscriptions")
      .select("user_id, plan, billing, status, current_period_end, cancel_at_period_end")
      .order("updated_at", { ascending: false }),
    supabase
      .from("applications")
      .select("user_id, status, sent_at")
      .order("created_at", { ascending: false })
      .limit(APPLICATION_LIMIT),
    supabase.from("offers").select("id", { count: "exact", head: true }).is("removed_at", null),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase.from("hiring_companies").select("id", { count: "exact", head: true }),
    supabase
      .from("billing_events")
      .select("event_id, provider, type, created_at, processed_at")
      .order("created_at", { ascending: false })
      .limit(EVENT_LIMIT),
    supabase
      .from("offer_search_runs")
      .select("query_key, source, fetched_at, result_count, status_code")
      .order("fetched_at", { ascending: false })
      .limit(EVENT_LIMIT),
  ]);

  const profileRows = rowsOrThrow("admin.profiles", profiles);
  return {
    profiles: profileRows,
    subscriptions: rowsOrThrow("admin.subscriptions", subscriptions),
    applications: rowsOrThrow("admin.applications", applications),
    liveOffers: countOrThrow("admin.offers", liveOffers),
    matches: countOrThrow("admin.matches", matches),
    hiringCompanies: countOrThrow("admin.hiring_companies", hiringCompanies),
    billingEvents: rowsOrThrow("admin.billing_events", billingEvents),
    searchRuns: rowsOrThrow("admin.offer_search_runs", searchRuns),
    truncated: profileRows.length >= PROFILE_LIMIT,
  };
}

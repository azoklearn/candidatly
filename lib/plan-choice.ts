import { logger } from "@/lib/logger";
import type { ProfileForHiringCompanies } from "@/lib/offers/hiring-companies";
import { toSearchKey } from "@/lib/offers/search-keys";
import type { Db } from "@/lib/offers/sync";
import { PLAN_IDS, type PlanCounts, type PlanId } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

/** How many students chose each plan, for the "most chosen" badge; null when unavailable. */
export async function loadPlanCounts(): Promise<PlanCounts | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("chosen_plan")
      .not("chosen_plan", "is", null)
      .limit(10_000);
    if (error) return null;
    const counts: PlanCounts = { basic: 0, plus: 0, premium: 0 };
    for (const row of data) {
      if ((PLAN_IDS as readonly string[]).includes(row.chosen_plan ?? "")) {
        counts[row.chosen_plan as PlanId]++;
      }
    }
    return counts;
  } catch {
    return null;
  }
}

/** Hiring companies stored for the student's current search (C80). */
export async function countHiringCompanies(
  db: Db,
  profile: ProfileForHiringCompanies,
): Promise<number> {
  const { location_lat: lat, location_lng: lng } = profile;
  if (lat === null || lng === null || profile.rome_codes.length === 0) return 0;
  const { key } = toSearchKey({
    romeCodes: profile.rome_codes,
    lat,
    lng,
    radiusKm: profile.search_radius_km,
    diplomaLevel: profile.diploma_level,
  });
  const { count, error } = await db
    .from("hiring_companies")
    .select("id", { count: "exact", head: true })
    .eq("query_key", key);
  if (error) {
    logger.warn("hiring_companies_count_failed", { code: error.code });
    return 0;
  }
  return count ?? 0;
}

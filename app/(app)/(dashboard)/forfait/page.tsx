import type { Metadata } from "next";

import { PricingTable } from "@/components/pricing-table";
import { requireUserId } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/errors";
import { searchSummary } from "@/lib/offers/search-summary";
import { countHiringCompanies, loadPlanCounts } from "@/lib/plan-choice";
import { featuredBadge } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

import { choosePlan } from "./actions";

export const metadata: Metadata = { title: "Votre forfait" };

/** Shown right after the questionnaire: what the search found, then the plans (C82). */
export default async function ChoosePlanPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const [offers, profile, counts] = await Promise.all([
    supabase
      .from("matches")
      .select("id, offer:offers!inner(removed_at)", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .is("offer.removed_at", null),
    supabase
      .from("profiles")
      .select("rome_codes, location_lat, location_lng, search_radius_km, diploma_level")
      .eq("user_id", userId)
      .maybeSingle(),
    loadPlanCounts(),
  ]);
  if (offers.error) throw new DatabaseError("matches.count", offers.error);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  const companies = profile.data ? await countHiringCompanies(supabase, profile.data) : 0;
  const summary = searchSummary(offers.count ?? 0, companies);

  return (
    <div className="grid gap-12">
      <header className="fade-up grid justify-items-center gap-3 text-center">
        <p className="eyebrow">Votre recherche est prête</p>
        <h1 className="page-title max-w-3xl">
          {summary.before}
          <em>{summary.highlight}</em>
          {summary.after}
        </h1>
        {summary.extra ? <p className="text-muted-foreground">{summary.extra}</p> : null}
        <p className="max-w-xl text-muted-foreground">
          Choisissez votre forfait pour les découvrir et candidater.
        </p>
      </header>
      <PricingTable badge={featuredBadge(counts)} choose={choosePlan} />
      <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
        En formule annuelle, le prix barré est le prix du même forfait payé au mois. Les fonctions
        marquées « Bientôt » ne sont pas encore disponibles.
      </p>
    </div>
  );
}

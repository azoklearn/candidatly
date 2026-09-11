import type { Metadata } from "next";
import Link from "next/link";

import { PricingTable } from "@/components/pricing-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";
import { loadAccess } from "@/lib/billing/access";
import { DatabaseError } from "@/lib/errors";
import { searchSummary } from "@/lib/offers/search-summary";
import { countHiringCompanies, loadPlanCounts } from "@/lib/plan-choice";
import { PLANS, featuredBadge } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

import { choosePlan } from "./actions";

export const metadata: Metadata = { title: "Votre forfait" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Shown right after the questionnaire: what the search found, then the plans (C82, C83). */
export default async function ChoosePlanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const [offers, profile, counts, access] = await Promise.all([
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
    loadAccess(supabase, userId),
  ]);
  if (offers.error) throw new DatabaseError("matches.count", offers.error);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  const companies = profile.data ? await countHiringCompanies(supabase, profile.data) : 0;
  const summary = searchSummary(offers.count ?? 0, companies);
  const current = access.paywall ? access.subscription : null;
  const currentName = PLANS.find((plan) => plan.id === current?.plan)?.name;

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
          {current
            ? `Votre forfait ${currentName} est actif.`
            : "Choisissez votre forfait pour les découvrir et candidater."}
        </p>
      </header>

      {params.paiement === "indisponible" ? (
        <Alert variant="destructive" className="mx-auto max-w-xl">
          <AlertDescription>
            Le paiement n’a pas pu démarrer. Réessayez dans un instant.
          </AlertDescription>
        </Alert>
      ) : null}

      {current ? (
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/offers" className={buttonVariants({ variant: "shiny", size: "lg" })}>
            Voir mes offres
          </Link>
          {current.manage_url ? (
            <a
              href={current.manage_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Changer de forfait
            </a>
          ) : null}
        </div>
      ) : (
        <>
          <PricingTable badge={featuredBadge(counts)} choose={choosePlan} />
          <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
            Paiement sécurisé par Whop. En formule annuelle, le prix barré est le prix du même
            forfait payé au mois. Les fonctions marquées « Bientôt » ne sont pas encore disponibles.
          </p>
        </>
      )}
    </div>
  );
}

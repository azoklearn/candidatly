import type { Metadata } from "next";
import Link from "next/link";

import { ResultStack } from "@/components/result-stack";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";
import { loadAccess } from "@/lib/billing/access";
import { DatabaseError } from "@/lib/errors";
import { companiesOnly } from "@/lib/offers/contract-mode";
import { pulseSentence, searchPulse } from "@/lib/offers/pulse";
import { searchSummary } from "@/lib/offers/search-summary";
import { countHiringCompanies } from "@/lib/plan-choice";
import { PLANS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ta recherche" };

/**
 * Shown right after the questionnaire: what the search found, in words and without a figure,
 * and one button to the plans (owner, 7 November 2026, C104, C105). The plans themselves live
 * on /forfait/choisir.
 */
export default async function SearchResultPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const [offers, dates, profile, access] = await Promise.all([
    supabase
      .from("matches")
      .select("id, offer:offers!inner(removed_at)", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .is("offer.removed_at", null),
    // Publication dates only, to say how alive the selection is without inventing anything.
    supabase
      .from("matches")
      .select("offer:offers!inner(published_at, removed_at)")
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .is("offer.removed_at", null)
      .limit(300),
    supabase
      .from("profiles")
      .select(
        "rome_codes, location_lat, location_lng, search_radius_km, diploma_level, target_contract",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    loadAccess(supabase, userId),
  ]);
  if (offers.error) throw new DatabaseError("matches.count", offers.error);
  if (dates.error) throw new DatabaseError("matches.dates", dates.error);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  const companies = profile.data ? await countHiringCompanies(supabase, profile.data) : 0;
  // An internship or a student job: companies of the student's trades, no offers (C106).
  const domainOnly = companiesOnly(profile.data?.target_contract);
  const summary = searchSummary(offers.count ?? 0, companies, { companiesOnly: domainOnly });
  const pulse = domainOnly ? null : pulseSentence(searchPulse(dates.data.map((row) => row.offer)));
  const current = access.paywall ? access.subscription : null;
  const currentName = PLANS.find((plan) => plan.id === current?.plan)?.name;

  return (
    <header className="grid min-h-[62svh] content-center justify-items-center gap-4 text-center">
      <ResultStack />
      <h1 className="page-title fade-up max-w-3xl">
        {summary.before}
        <em className="marker">{summary.highlight}</em>
        {summary.after}
      </h1>
      {summary.extra ? <p className="text-muted-foreground">{summary.extra}</p> : null}
      {pulse ? (
        <p className="pulse-strip text-muted-foreground">
          <span className="pulse-dot" aria-hidden />
          {pulse}
        </p>
      ) : null}
      {current ? (
        <>
          <p className="max-w-xl text-muted-foreground">Ton forfait {currentName} est actif.</p>
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
        </>
      ) : (
        <Link
          href="/forfait/choisir"
          className={`${buttonVariants({ variant: "shiny", size: "lg" })} q-card mt-3 h-13 px-8 text-base`}
        >
          {domainOnly ? "Découvrir les entreprises" : "Découvrir les offres"}{" "}
          <span aria-hidden>→</span>
        </Link>
      )}
    </header>
  );
}

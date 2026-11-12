import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { PlanProof } from "@/components/plan-proof";
import { PricingTable } from "@/components/pricing-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireUserId } from "@/lib/auth/session";
import { loadAccess } from "@/lib/billing/access";
import { billingProvider } from "@/lib/env";
import { DatabaseError } from "@/lib/errors";
import { STUDY_LEVEL_LABELS, cityFromAddress, formatDistance } from "@/lib/format";
import { companiesOnly } from "@/lib/offers/contract-mode";
import { toTeaserCards } from "@/lib/offers/teaser";
import { loadPlanCounts } from "@/lib/plan-choice";
import { featuredBadge } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

import { choosePlan } from "./actions";
import { OfferTeaser } from "./_components/offer-teaser";

export const metadata: Metadata = { title: "Choisis ton forfait" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The paywall, reached from the search result on /forfait (C82, C83, C105). */
export default async function ChoosePlanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const [offers, preview, profile, counts, access] = await Promise.all([
    supabase
      .from("matches")
      .select("id, offer:offers!inner(removed_at)", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .is("offer.removed_at", null),
    // Only coarse columns: the title and the employer never leave the server (C88).
    supabase
      .from("matches")
      .select("score, offer:offers!inner(location_label, contract_types, published_at, removed_at)")
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .is("offer.removed_at", null)
      .order("score", { ascending: false })
      .limit(4),
    supabase
      .from("profiles")
      .select("rome_codes, location_label, search_radius_km, diploma_level, target_contract")
      .eq("user_id", userId)
      .maybeSingle(),
    loadPlanCounts(),
    loadAccess(supabase, userId),
  ]);
  // A second checkout would bill twice: an active plan is managed from /forfait.
  if (access.paywall && access.subscription) redirect("/forfait");
  if (offers.error) throw new DatabaseError("matches.count", offers.error);
  if (preview.error) throw new DatabaseError("matches.preview", preview.error);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  const jobs =
    profile.data && profile.data.rome_codes.length > 0
      ? await supabase.from("rome_codes").select("code, label").in("code", profile.data.rome_codes)
      : null;

  // An internship or a student job: companies of the student's trades, no offers (C106).
  const domainOnly = companiesOnly(profile.data?.target_contract);

  // What we understood of their search, so they can see it is really theirs before paying.
  const jobLabels = (jobs?.data ?? []).map((row) => row.label);
  const city = cityFromAddress(profile.data?.location_label);
  const diplomaLevel = profile.data?.diploma_level ?? null;
  const level = diplomaLevel === null ? null : STUDY_LEVEL_LABELS[diplomaLevel];
  const chips = [
    ...jobLabels.slice(0, 3),
    ...(jobLabels.length > 3 ? [`+ ${jobLabels.length - 3} autres métiers`] : []),
    ...(city ? [city] : []),
    ...(profile.data ? [`jusqu’à ${formatDistance(profile.data.search_radius_km)}`] : []),
    ...(level ? [level] : []),
  ];

  return (
    <div className="grid gap-12">
      <header className="fade-up grid justify-items-center gap-3 text-center">
        <p className="eyebrow">Dernière étape</p>
        <h1 className="page-title max-w-3xl">
          Choisis ton <em>forfait</em>
        </h1>
        <p className="max-w-xl text-muted-foreground">
          {domainOnly
            ? "Pour découvrir les entreprises de ton domaine et les contacter."
            : "Pour découvrir tes offres et candidater."}
        </p>
      </header>

      {params.paiement === "indisponible" ? (
        <Alert variant="destructive" className="mx-auto max-w-xl">
          <AlertDescription>
            Le paiement n’a pas pu démarrer. Réessaie dans un instant.
          </AlertDescription>
        </Alert>
      ) : null}

      <PricingTable badge={featuredBadge(counts)} choose={choosePlan} />
      <p className="mx-auto -mt-6 max-w-2xl text-center text-xs text-muted-foreground">
        Paiement sécurisé par {billingProvider() === "mollie" ? "Mollie" : "Whop"}. En formule
        annuelle, le prix barré est le prix du même forfait payé au mois. Les fonctions marquées «
        Bientôt » ne sont pas encore disponibles.
      </p>

      {chips.length > 0 ? (
        <section
          aria-label="Ce qu’on a retenu de ta recherche"
          className="fade-up mx-auto grid w-full max-w-2xl justify-items-center gap-2 rounded-2xl border border-dashed bg-card/60 p-4 text-center"
        >
          <p className="eyebrow">Ta recherche</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {chips.map((chip, index) => (
              <li
                key={chip}
                style={{ "--i": index } as CSSProperties}
                className="rise rounded-full border bg-card px-3 py-1 text-sm"
              >
                {chip}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Tu peux la modifier à tout moment depuis ton compte.
          </p>
        </section>
      ) : null}

      {domainOnly ? null : (
        <OfferTeaser cards={toTeaserCards(preview.data)} total={offers.count ?? 0} />
      )}
      <PlanProof
        preview={
          domainOnly
            ? "Toutes les entreprises de ton domaine dans ton rayon, les plus proches d’abord. On ne t’annonce pas de chiffre avant que tu les voies."
            : "Toute ta sélection du jour, calculée sur tes métiers, ton niveau et ton rayon. Elle bouge chaque jour : les offres sont retirées dès qu’elles expirent et la recherche tourne plusieurs fois par jour. On ne t’annonce pas de chiffre avant que tu les voies."
        }
      />
    </div>
  );
}

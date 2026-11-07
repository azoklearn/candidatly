import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { PlanProof } from "@/components/plan-proof";
import { PricingTable } from "@/components/pricing-table";
import { ShareResult } from "@/components/share-result";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";
import { loadAccess } from "@/lib/billing/access";
import { DatabaseError } from "@/lib/errors";
import { STUDY_LEVEL_LABELS, cityFromAddress, formatDistance } from "@/lib/format";
import { pulseSentence, searchPulse } from "@/lib/offers/pulse";
import { searchSummary } from "@/lib/offers/search-summary";
import { toTeaserCards } from "@/lib/offers/teaser";
import { countHiringCompanies, loadPlanCounts } from "@/lib/plan-choice";
import { PLANS, featuredBadge } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

import { choosePlan } from "./actions";
import { OfferTeaser } from "./_components/offer-teaser";

export const metadata: Metadata = { title: "Votre forfait" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Shown right after the questionnaire: what the search found, then the plans (C82, C83). */
export default async function ChoosePlanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const [offers, preview, dates, profile, counts, access] = await Promise.all([
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
        "rome_codes, location_label, location_lat, location_lng, search_radius_km, diploma_level",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    loadPlanCounts(),
    loadAccess(supabase, userId),
  ]);
  if (offers.error) throw new DatabaseError("matches.count", offers.error);
  if (preview.error) throw new DatabaseError("matches.preview", preview.error);
  if (dates.error) throw new DatabaseError("matches.dates", dates.error);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  const [companies, jobs] = await Promise.all([
    profile.data ? countHiringCompanies(supabase, profile.data) : 0,
    profile.data && profile.data.rome_codes.length > 0
      ? supabase.from("rome_codes").select("code, label").in("code", profile.data.rome_codes)
      : null,
  ]);
  const offerCount = offers.count ?? 0;
  const summary = searchSummary(offerCount, companies);
  const pulse = pulseSentence(searchPulse(dates.data.map((row) => row.offer)));
  const current = access.paywall ? access.subscription : null;
  const currentName = PLANS.find((plan) => plan.id === current?.plan)?.name;

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
        <p className="eyebrow">Ta recherche est prête</p>
        <h1 className="page-title max-w-3xl">
          {summary.before}
          <em>{summary.highlight}</em>
          {summary.after}
        </h1>
        {summary.extra ? <p className="text-muted-foreground">{summary.extra}</p> : null}
        {pulse ? (
          <p className="pulse-strip text-muted-foreground">
            <span className="pulse-dot" aria-hidden />
            {pulse}
          </p>
        ) : null}
        <p className="max-w-xl text-muted-foreground">
          {current
            ? `Ton forfait ${currentName} est actif.`
            : "Choisis ton forfait pour les découvrir et candidater."}
        </p>
        {current ? null : (
          <a
            href="#forfaits"
            className={`${buttonVariants({ variant: "shiny", size: "lg" })} mt-1`}
          >
            Découvrir les offres <span aria-hidden>↓</span>
          </a>
        )}
        {offerCount > 0 ? (
          <ShareResult text="J’ai trouvé des offres d’alternance près de chez moi en 2 minutes avec JobGPT." />
        ) : null}
      </header>

      {params.paiement === "indisponible" ? (
        <Alert variant="destructive" className="mx-auto max-w-xl">
          <AlertDescription>
            Le paiement n’a pas pu démarrer. Réessaie dans un instant.
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

          <OfferTeaser cards={toTeaserCards(preview.data)} total={offerCount} />
          <PricingTable badge={featuredBadge(counts)} choose={choosePlan} />
          <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
            Paiement sécurisé par Whop. En formule annuelle, le prix barré est le prix du même
            forfait payé au mois. Les fonctions marquées « Bientôt » ne sont pas encore disponibles.
          </p>
          <PlanProof
            preview={
              offerCount > 0
                ? "Tu l’as déjà vu : le chiffre en haut de cette page est ta vraie sélection du jour, calculée sur tes métiers, ton niveau et ton rayon. Elle bouge chaque jour, parce que les offres sont retirées dès qu’elles expirent et que la recherche tourne plusieurs fois par jour."
                : "Ça dépend de ton métier et de ton rayon, et on ne te promet pas un chiffre qu’on ne connaît pas. La recherche tourne plusieurs fois par jour et le compteur en haut de cette page est toujours ta vraie sélection du moment."
            }
          />
        </>
      )}
    </div>
  );
}

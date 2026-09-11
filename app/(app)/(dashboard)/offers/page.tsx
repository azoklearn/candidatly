import type { Metadata } from "next";
import Link from "next/link";

import { PendingOverlay } from "@/components/pending-overlay";
import { Button } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/errors";
import { readScoreReasons } from "@/lib/matching/reasons";
import { applyOfferFilters, parseOfferFilters } from "@/lib/offers/filters";
import { FEW_OFFERS, loadHiringCompanies } from "@/lib/offers/hiring-companies";
import { createClient } from "@/lib/supabase/server";

import { refreshMyOffers } from "./actions";
import { HiringCompanyCard } from "./_components/hiring-company-card";
import { OfferCard, type OfferCardData } from "./_components/offer-card";
import { OfferFilters } from "./_components/offer-filters";

export const metadata: Metadata = { title: "Offres" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

export default async function OffersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    maxKm: first(params.km),
    days: first(params.days),
    company: first(params.company).trim(),
    view: first(params.view),
  };
  const supabase = await createClient();
  const userId = await requireUserId(supabase);

  const [matches, profile] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, score, score_reasons, status, offer:offers!inner(id, title, company_name, company_siret, location_label, published_at, is_delegated, contract_types, removed_at)",
      )
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .is("offer.removed_at", null)
      .order("score", { ascending: false })
      .limit(300),
    supabase
      .from("profiles")
      .select("rome_codes, location_lat, location_lng, search_radius_km, diploma_level")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (matches.error) throw new DatabaseError("matches.select", matches.error);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);

  const sirets = [
    ...new Set(matches.data.flatMap((m) => (m.offer.company_siret ? [m.offer.company_siret] : []))),
  ];
  const companies = sirets.length
    ? await supabase.from("companies").select("siret").in("siret", sirets)
    : { data: [] as { siret: string }[] };
  const withCard = new Set((companies.data ?? []).map((c) => c.siret));

  const all: OfferCardData[] = matches.data.map((m) => {
    const reasons = readScoreReasons(m.score_reasons);
    return {
      matchId: m.id,
      status: m.status,
      score: Number(m.score),
      distanceKm: reasons?.distanceKm ?? null,
      offer: m.offer,
      hasCompanyCard: m.offer.company_siret !== null && withCard.has(m.offer.company_siret),
    };
  });
  const cards = applyOfferFilters(
    all,
    parseOfferFilters({
      km: filters.maxKm,
      days: filters.days,
      company: filters.company,
      view: filters.view,
    }),
  );
  const total = matches.data.length;
  // While published offers are scarce, companies that hire apprentices in the student's
  // trades complete the page (docs/QUESTIONS.md C80).
  const hiringCompanies =
    total < FEW_OFFERS && profile.data ? await loadHiringCompanies(supabase, profile.data) : [];

  const subtitle =
    total > 0
      ? `${cards.length} offre${cards.length > 1 ? "s" : ""} sur ${total}, triées par correspondance avec votre profil.`
      : hiringCompanies.length > 0
        ? "Des entreprises de votre domaine à contacter dès maintenant."
        : "Les offres d’alternance publiées près de chez vous, triées selon votre profil.";

  return (
    <div className="grid gap-8">
      <div className="fade-up flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <p className="eyebrow">Votre sélection</p>
          <h1 className="page-title">
            Vos <em>offres</em>
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <form action={refreshMyOffers}>
          <Button type="submit" variant="outline" size="sm">
            Actualiser
          </Button>
          <PendingOverlay
            title={
              <>
                On cherche les <em>nouveautés</em>
              </>
            }
            messages={[
              "Recherche des offres publiées…",
              "Mise à jour de vos correspondances…",
              "Presque prêt…",
            ]}
          />
        </form>
      </div>

      {total > 0 ? <OfferFilters values={filters} /> : null}
      {total > 0 && cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ces filtres sont un peu stricts : élargissez la distance ou la date, ou{" "}
          <Link href="/offers" className="font-medium text-brand underline underline-offset-4">
            affichez toute la sélection
          </Link>
          .
        </p>
      ) : null}
      {cards.length > 0 ? (
        <ul className="grid gap-3">
          {cards.map((card) => (
            <OfferCard key={card.matchId} data={card} />
          ))}
        </ul>
      ) : null}

      {total === 0 && hiringCompanies.length === 0 ? (
        <div className="fade-up grid justify-items-start gap-3 rounded-2xl border bg-card p-6">
          <p className="section-title">
            Votre sélection <em>se prépare</em>
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            De nouvelles offres sont publiées chaque jour : actualisez dans quelques instants pour
            les voir apparaître. Pour en recevoir davantage, élargissez votre rayon ou ajoutez des
            métiers depuis votre{" "}
            <Link href="/account" className="font-medium text-brand underline underline-offset-4">
              compte
            </Link>
            .
          </p>
        </div>
      ) : null}

      {hiringCompanies.length > 0 ? (
        <section aria-labelledby="hiring-companies" className="fade-up grid gap-4">
          <div className="grid gap-1.5">
            <p className="eyebrow">Candidature spontanée</p>
            <h2 id="hiring-companies" className="section-title">
              Entreprises à fort potentiel d’embauche <em>près de chez vous</em>
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              Repérées par La bonne alternance d’après leurs recrutements d’alternants dans vos
              métiers. Proposez-leur votre profil avec une candidature spontanée.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {hiringCompanies.map((company) => (
              <HiringCompanyCard key={company.id} company={company} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Offres et entreprises issues de La bonne alternance et de ses partenaires, via l’API
        Alternance.
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { PendingOverlay } from "@/components/pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";
import { requirePaidAccess } from "@/lib/billing/access";
import { DatabaseError } from "@/lib/errors";
import { cityFromAddress, contractLabel, formatDistance, formatRelativeDays } from "@/lib/format";
import { analyseMatch } from "@/lib/matching/analysis";
import { readScoreReasons } from "@/lib/matching/reasons";
import { applyOfferFilters, parseOfferFilters } from "@/lib/offers/filters";
import { companiesOnly } from "@/lib/offers/contract-mode";
import {
  FEW_OFFERS,
  MAX_SHOWN_COMPANIES_ONLY,
  loadHiringCompanies,
} from "@/lib/offers/hiring-companies";
import { isNoiseKind } from "@/lib/offers/noise";
import { toTargetDiplomaLevel } from "@/lib/providers/api-alternance";
import { createClient } from "@/lib/supabase/server";

import { refreshMyOffers, setNoiseHidden } from "./actions";
import { HiringCompanyCard } from "./_components/hiring-company-card";
import { OfferCard, type OfferCardData } from "./_components/offer-card";
import { OfferFilters } from "./_components/offer-filters";
import { SwipeDeck, type SwipeCard } from "./_components/swipe-deck";

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
  // The same offers, one at a time, to keep or set aside with the thumb (C120).
  const swipe = first(params.mode) === "swipe";
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  await requirePaidAccess(supabase, userId);

  const [matches, profile, cv] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, score, score_reasons, status, offer:offers!inner(id, title, company_name, company_siret, location_label, published_at, is_delegated, noise_kind, diploma_level, contract_types, removed_at)",
      )
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .is("offer.removed_at", null)
      .order("score", { ascending: false })
      .limit(300),
    supabase
      .from("profiles")
      .select(
        "rome_codes, location_lat, location_lng, search_radius_km, diploma_level, target_contract, hide_noise",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "cv")
      .eq("is_current", true)
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
  const filtered = applyOfferFilters(
    all,
    parseOfferFilters({
      km: filters.maxKm,
      days: filters.days,
      company: filters.company,
      view: filters.view,
    }),
  );
  // Schools, training bodies and agencies are hidden unless the student asked for them
  // (C120). An offer already kept or applied to is never taken away.
  const hideNoise = profile.data?.hide_noise ?? true;
  const isNoise = (card: OfferCardData) =>
    isNoiseKind(card.offer.noise_kind) && card.status === "new";
  const hiddenCount = hideNoise ? filtered.filter(isNoise).length : 0;
  const cards = hideNoise ? filtered.filter((card) => !isNoise(card)) : filtered;
  // An internship or a student job: the companies of the student's trades are the page (C106).
  if (profile.data && companiesOnly(profile.data.target_contract)) {
    const contract = profile.data.target_contract === "job_etudiant" ? "job étudiant" : "stage";
    const domainCompanies = await loadHiringCompanies(
      supabase,
      profile.data,
      MAX_SHOWN_COMPANIES_ONLY,
    );
    return (
      <div className="grid gap-8">
        <div className="fade-up grid gap-2">
          <p className="eyebrow">Votre sélection</p>
          <h1 className="page-title">
            Vos <em>entreprises</em>
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Les entreprises de vos métiers près de chez vous, les plus proches d’abord.
            Proposez-leur votre profil pour un {contract}. Être listée ne garantit pas qu’un poste
            est ouvert.
          </p>
        </div>
        {domainCompanies.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 sm:items-start">
            {domainCompanies.map((company, index) => (
              <HiringCompanyCard key={company.id} company={company} index={index} domainOnly />
            ))}
          </ul>
        ) : (
          <div className="panel-tint fade-up grid justify-items-start gap-3 rounded-2xl border p-6">
            <p className="section-title">
              Votre sélection <em>se prépare</em>
            </p>
            <p className="max-w-prose text-sm text-muted-foreground">
              Pour voir plus d’entreprises, élargissez votre rayon ou ajoutez des métiers depuis
              votre{" "}
              <Link href="/account" className="font-medium text-brand underline underline-offset-4">
                compte
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    );
  }

  const total = hideNoise ? all.filter((card) => !isNoise(card)).length : all.length;
  const everything = all.length;
  const profileLevel = Number(toTargetDiplomaLevel(profile.data?.diploma_level)) || null;
  const swipeCards: SwipeCard[] = swipe
    ? cards
        .filter((card) => card.status === "new")
        .map((card) => {
          const match = matches.data.find((item) => item.id === card.matchId);
          const reasons = readScoreReasons(match?.score_reasons);
          const analysis = reasons
            ? analyseMatch({
                reasons,
                radiusKm: profile.data?.search_radius_km ?? null,
                profileLevel,
                offerLevel: match?.offer.diploma_level ?? null,
                desiredSkills: [],
                hasCv: cv.data !== null,
                cvText: null,
                noiseKind: card.offer.noise_kind,
              })
            : null;
          return {
            matchId: card.matchId,
            offerId: card.offer.id,
            title: card.offer.title,
            company: card.offer.company_name,
            details: [
              cityFromAddress(card.offer.location_label),
              card.distanceKm === null ? null : formatDistance(card.distanceKm),
              formatRelativeDays(card.offer.published_at),
            ]
              .filter(Boolean)
              .join(" · "),
            contract: contractLabel(card.offer.contract_types),
            score: card.score,
            fits: (analysis?.fits ?? []).slice(0, 4).map((point) => point.short),
            gaps: (analysis?.gaps ?? []).slice(0, 3).map((point) => point.short),
          };
        })
    : [];
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

      {everything > 0 ? (
        <nav
          aria-label="Affichage des offres"
          className="flex w-fit gap-1 rounded-full p-1 glass-bar"
        >
          <Link
            href="/offers"
            aria-current={swipe ? undefined : "page"}
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
          >
            Liste
          </Link>
          <Link
            href="/offers?mode=swipe"
            aria-current={swipe ? "page" : undefined}
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
          >
            Une par une
          </Link>
        </nav>
      ) : null}

      {total > 0 && !swipe ? <OfferFilters values={filters} /> : null}
      {hiddenCount > 0 || (!hideNoise && all.some((card) => isNoiseKind(card.offer.noise_kind))) ? (
        <form
          action={setNoiseHidden.bind(null, !hideNoise)}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground"
        >
          <p>
            {hideNoise
              ? `${hiddenCount} ${hiddenCount > 1 ? "offres masquées" : "offre masquée"} : écoles, organismes de formation et agences d’intérim ou de recrutement.`
              : "Les offres d’écoles, d’organismes de formation et d’agences sont affichées."}
          </p>
          <SubmitButton variant="outline" size="sm" pendingLabel="Un instant…">
            {hideNoise ? "Les afficher" : "Les masquer"}
          </SubmitButton>
        </form>
      ) : null}
      {swipe && everything > 0 ? <SwipeDeck cards={swipeCards} /> : null}
      {!swipe && total > 0 && cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ces filtres sont un peu stricts : élargissez la distance ou la date, ou{" "}
          <Link href="/offers" className="font-medium text-brand underline underline-offset-4">
            affichez toute la sélection
          </Link>
          .
        </p>
      ) : null}
      {!swipe && cards.length > 0 ? (
        <ul className="grid gap-3">
          {cards.map((card, index) => (
            <OfferCard key={card.matchId} data={card} index={index} />
          ))}
        </ul>
      ) : null}

      {total === 0 && hiringCompanies.length === 0 ? (
        <div className="panel-tint fade-up grid justify-items-start gap-3 rounded-2xl border p-6">
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
              Elles embauchent souvent des alternants dans vos métiers. Être listée ne garantit pas
              qu’un poste est ouvert : proposez-leur votre profil avec une candidature spontanée.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 sm:items-start">
            {hiringCompanies.map((company, index) => (
              <HiringCompanyCard key={company.id} company={company} index={index} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/errors";
import { readScoreReasons } from "@/lib/matching/reasons";
import { applyOfferFilters, parseOfferFilters } from "@/lib/offers/filters";
import { createClient } from "@/lib/supabase/server";

import { refreshMyOffers } from "./actions";
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

  const matches = await supabase
    .from("matches")
    .select(
      "id, score, score_reasons, status, offer:offers!inner(id, title, company_name, company_siret, location_label, published_at, is_delegated, contract_types, removed_at)",
    )
    .eq("user_id", userId)
    .neq("status", "dismissed")
    .is("offer.removed_at", null)
    .order("score", { ascending: false })
    .limit(300);
  if (matches.error) throw new DatabaseError("matches.select", matches.error);

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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vos offres</h1>
          <p className="text-sm text-muted-foreground">
            {matches.data.length === 0
              ? "Offres d’alternance publiées, triées par correspondance avec votre profil."
              : `${cards.length} offre${cards.length > 1 ? "s" : ""} sur ${matches.data.length}, triées par correspondance avec votre profil.`}
          </p>
        </div>
        <form action={refreshMyOffers}>
          <Button type="submit" variant="outline" size="sm">
            Actualiser
          </Button>
        </form>
      </div>
      {matches.data.length > 0 ? <OfferFilters values={filters} /> : null}
      {matches.data.length === 0 ? (
        <div className="grid gap-2 rounded-xl border p-6 text-sm">
          <p className="font-medium">Aucune offre pour le moment.</p>
          <p className="text-muted-foreground">
            La recherche vient peut-être de démarrer : actualisez dans quelques instants. Si rien
            n’apparaît, élargissez votre rayon ou ajoutez des métiers depuis votre{" "}
            <Link href="/account" className="underline underline-offset-4">
              compte
            </Link>
            .
          </p>
        </div>
      ) : cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune offre ne correspond à ces filtres.</p>
      ) : (
        <ul className="grid gap-3">
          {cards.map((card) => (
            <OfferCard key={card.matchId} data={card} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Offres publiées sur La bonne alternance et ses partenaires, via l’API Alternance.
      </p>
    </div>
  );
}

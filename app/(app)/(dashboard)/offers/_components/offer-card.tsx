import Link from "next/link";

import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { cityFromAddress, contractLabel, formatDistance, formatRelativeDays } from "@/lib/format";

import { setMatchStatus } from "../actions";

export type OfferCardData = {
  matchId: string;
  status: string;
  score: number;
  distanceKm: number | null;
  offer: {
    id: string;
    title: string;
    company_name: string | null;
    location_label: string | null;
    published_at: string | null;
    is_delegated: boolean;
    contract_types: string[];
  };
  hasCompanyCard: boolean;
};

export function OfferCard({ data }: { data: OfferCardData }) {
  const { offer } = data;
  const saved = data.status === "saved";
  const details = [
    offer.company_name,
    cityFromAddress(offer.location_label),
    data.distanceKm === null ? null : formatDistance(data.distanceKm),
    formatRelativeDays(offer.published_at),
  ].filter(Boolean);

  return (
    <li className="card-lift grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <Link
            href={`/offers/${offer.id}`}
            className="text-[1.05rem] leading-snug font-semibold tracking-[-0.02em] hover:text-brand"
          >
            {offer.title}
          </Link>
          <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
        </div>
        <span className="match-pill shrink-0" title="Correspondance avec votre profil">
          ✦ {Math.round(data.score)} %
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Tag>{contractLabel(offer.contract_types)}</Tag>
        {data.hasCompanyCard ? <Tag>Fiche entreprise disponible</Tag> : null}
        {offer.is_delegated ? <Tag>Offre gérée par une école</Tag> : null}
        {saved ? <Tag>Enregistrée</Tag> : null}
        {data.status === "applied" ? <Tag>Candidature envoyée</Tag> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-foreground/10 pt-3">
        <Link
          href={`/offers/${offer.id}`}
          className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
        >
          Voir le détail <span aria-hidden>→</span>
        </Link>
        <form
          action={setMatchStatus.bind(null, data.matchId, saved ? "new" : "saved")}
          className="ml-auto"
        >
          <Button type="submit" variant="outline" size="sm">
            {saved ? "Retirer des favoris" : "Enregistrer"}
          </Button>
        </form>
        <form action={setMatchStatus.bind(null, data.matchId, "dismissed")}>
          <Button type="submit" variant="ghost" size="sm">
            Ignorer
          </Button>
        </form>
      </div>
    </li>
  );
}

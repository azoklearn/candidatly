import Link from "next/link";

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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

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
    <li className="grid gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <Link href={`/offers/${offer.id}`} className="font-medium hover:underline">
            {offer.title}
          </Link>
          <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
        </div>
        <span
          className="shrink-0 rounded-md border px-2 py-1 text-sm font-medium"
          title="Correspondance avec votre profil"
        >
          {Math.round(data.score)} %
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{contractLabel(offer.contract_types)}</Badge>
        {data.hasCompanyCard ? <Badge>Fiche entreprise disponible</Badge> : null}
        {offer.is_delegated ? <Badge>Offre gérée par une école</Badge> : null}
        {saved ? <Badge>Enregistrée</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/offers/${offer.id}`}
          className="text-sm font-medium underline underline-offset-4"
        >
          Voir le détail
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

import { cityFromAddress, contractLabel, formatRelativeDays } from "@/lib/format";

/**
 * Coarse preview of the matches, shown before the plan is paid (docs/QUESTIONS.md C88).
 * Only city, contract, freshness and the match score leave the server: the job title and
 * the employer are never sent, so no browser tool can reveal them. The blur in the page is
 * applied to empty bars, not to hidden text.
 */

export type TeaserRow = {
  score: number;
  offer: {
    location_label: string | null;
    contract_types: string[];
    published_at: string | null;
  };
};

export type TeaserCard = {
  city: string | null;
  contract: string;
  freshness: string | null;
  score: number;
};

export function toTeaserCards(rows: TeaserRow[], limit = 4, now: Date = new Date()): TeaserCard[] {
  return rows.slice(0, limit).map((row) => ({
    city: cityFromAddress(row.offer.location_label),
    contract: contractLabel(row.offer.contract_types),
    freshness: formatRelativeDays(row.offer.published_at, now),
    score: Math.round(Number(row.score)),
  }));
}

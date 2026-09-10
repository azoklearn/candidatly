/** Filters of the offers list (brief section 5.2): distance, publication date, company, saved only. */

export type OfferFilters = {
  maxKm: number | null;
  maxDays: number | null;
  company: string;
  savedOnly: boolean;
};

export type FilterableOffer = {
  status: string;
  distanceKm: number | null;
  offer: { published_at: string | null; company_name: string | null };
};

const DAY_MS = 86_400_000;

export function parseOfferFilters(params: {
  km?: string;
  days?: string;
  company?: string;
  view?: string;
}): OfferFilters {
  const positive = (value: string | undefined) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };
  return {
    maxKm: positive(params.km),
    maxDays: positive(params.days),
    company: (params.company ?? "").trim().toLowerCase(),
    savedOnly: params.view === "saved",
  };
}

export function applyOfferFilters<T extends FilterableOffer>(
  items: T[],
  filters: OfferFilters,
  now: number = Date.now(),
): T[] {
  return items.filter((item) => {
    if (filters.savedOnly && item.status !== "saved") return false;
    if (filters.maxKm !== null && item.distanceKm !== null && item.distanceKm > filters.maxKm)
      return false;
    if (filters.maxDays !== null && item.offer.published_at) {
      const age = now - new Date(item.offer.published_at).getTime();
      if (age > filters.maxDays * DAY_MS) return false;
    }
    if (filters.company && !(item.offer.company_name ?? "").toLowerCase().includes(filters.company))
      return false;
    return true;
  });
}

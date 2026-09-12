import { NAF_LABELS } from "@/lib/enrichment/naf-labels";
import { cityFromAddress } from "@/lib/format";
import { formatPhone, telHref } from "@/lib/offers/contact";
import { logger } from "@/lib/logger";
import { haversineKm } from "@/lib/matching/score";
import type { ProfileDiplomaLevel } from "@/lib/providers/types";

import { toSearchKey } from "./search-keys";
import type { Db } from "./sync";

/**
 * Companies likely to hire apprentices in the student's trades, returned by the student's
 * own search (docs/QUESTIONS.md C80). Shown while published offers are scarce, with an
 * unsolicited application as the next step.
 */

/** Below this many offers, the offers page also shows hiring companies. */
export const FEW_OFFERS = 10;
const MAX_SHOWN = 12;

export type HiringCompanyCardData = {
  id: string;
  name: string;
  sector: string | null;
  headcount: string | null;
  city: string | null;
  distanceKm: number | null;
  applyUrl: string | null;
  phone: string | null;
  telHref: string | null;
};

export type HiringCompanyRow = {
  id: string;
  name: string;
  naf_code: string | null;
  naf_label: string | null;
  headcount: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  apply_url: string | null;
  phone?: string | null;
};

/** "10-19" becomes "10 à 19 salariés"; ranges without employees give null. */
export function formatHeadcount(range: string | null): string | null {
  const match = range?.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (max === 0) return null;
  if (min === max) return `${min} salarié${min > 1 ? "s" : ""}`;
  return `${min} à ${max} salariés`;
}

/** Sector label, from the source or from the NAF nomenclature ("6201Z" or "62.01Z"). */
export function sectorLabel(code: string | null, label: string | null): string | null {
  if (label?.trim()) return label.trim();
  const normalized = code
    ?.trim()
    .toUpperCase()
    .replace(/^(\d{2})\.?(\d{2}[A-Z])$/, "$1.$2");
  return normalized ? (NAF_LABELS[normalized] ?? null) : null;
}

/** Closest companies first, then alphabetical. */
export function rankHiringCompanies(
  rows: HiringCompanyRow[],
  origin: { lat: number; lng: number },
  limit = MAX_SHOWN,
): HiringCompanyCardData[] {
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      sector: sectorLabel(row.naf_code, row.naf_label),
      headcount: formatHeadcount(row.headcount),
      city: cityFromAddress(row.address),
      distanceKm:
        row.lat === null || row.lng === null
          ? null
          : haversineKm(origin, { lat: row.lat, lng: row.lng }),
      applyUrl: row.apply_url,
      phone: formatPhone(row.phone),
      telHref: telHref(row.phone),
    }))
    .sort(
      (a, b) =>
        (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
        a.name.localeCompare(b.name, "fr"),
    )
    .slice(0, limit);
}

export type ProfileForHiringCompanies = {
  rome_codes: string[];
  location_lat: number | null;
  location_lng: number | null;
  search_radius_km: number;
  diploma_level: ProfileDiplomaLevel | null;
};

/** Hiring companies of the student's current search. A read failure only hides the section. */
export async function loadHiringCompanies(
  db: Db,
  profile: ProfileForHiringCompanies,
): Promise<HiringCompanyCardData[]> {
  const { location_lat: lat, location_lng: lng } = profile;
  if (lat === null || lng === null || profile.rome_codes.length === 0) return [];
  const { key } = toSearchKey({
    romeCodes: profile.rome_codes,
    lat,
    lng,
    radiusKm: profile.search_radius_km,
    diplomaLevel: profile.diploma_level,
  });
  const { data, error } = await db
    .from("hiring_companies")
    .select("id, name, naf_code, naf_label, headcount, address, lat, lng, apply_url, phone")
    .eq("query_key", key)
    .limit(200);
  if (error) {
    logger.warn("hiring_companies_load_failed", { code: error.code });
    return [];
  }
  return rankHiringCompanies(data, { lat, lng });
}

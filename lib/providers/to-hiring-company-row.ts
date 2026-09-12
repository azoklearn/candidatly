import type { TablesInsert } from "@/lib/supabase/database.types";

import type { NormalizedHiringCompany, OfferSource } from "./types";

/** Maps a hiring company to a row, for an upsert on (source, query_key, external_id). */
export function toHiringCompanyRow(
  company: NormalizedHiringCompany,
  source: OfferSource,
  queryKey: string,
  seenAt: Date,
): TablesInsert<"hiring_companies"> {
  return {
    source,
    query_key: queryKey,
    external_id: company.externalId,
    siret: company.siret,
    name: company.name,
    naf_code: company.nafCode,
    naf_label: company.nafLabel,
    headcount: company.headcount,
    address: company.address,
    lat: company.lat,
    lng: company.lng,
    apply_url: company.applyUrl,
    phone: company.phone,
    last_seen_at: seenAt.toISOString(),
  };
}

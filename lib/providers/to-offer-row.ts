import type { TablesInsert } from "@/lib/supabase/database.types";

import type { NormalizedOffer } from "./types";

/** Maps a normalised offer to an offers row, for an upsert on (source, external_id). */
export function toOfferRow(offer: NormalizedOffer, seenAt: Date): TablesInsert<"offers"> {
  return {
    source: offer.source,
    external_id: offer.externalId,
    title: offer.title,
    description: offer.description,
    contract_types: offer.contractTypes,
    diploma_level: offer.diplomaLevel,
    company_name: offer.companyName,
    company_siret: offer.companySiret,
    company_website: offer.companyWebsite,
    is_delegated: offer.isDelegated,
    location_label: offer.locationLabel,
    postal_code: offer.postalCode,
    lat: offer.lat,
    lng: offer.lng,
    insee_code: offer.inseeCode,
    rome_codes: offer.romeCodes,
    published_at: offer.publishedAt,
    expires_at: offer.expiresAt,
    apply_channel: offer.applyChannel,
    apply_target: offer.applyTarget,
    raw: offer.raw,
    last_seen_at: seenAt.toISOString(),
    removed_at: null,
  };
}

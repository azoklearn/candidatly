import { z } from "zod";

import type { Enums, Json } from "@/lib/supabase/database.types";

/**
 * Source-agnostic contract for job offer providers (brief section 3.4): the API Alternance
 * today, Adzuna and France Travail for internships in V2.
 */

export type OfferSource = Enums<"offers_source">;
export type ApplyChannel = Enums<"offers_apply_channel">;
export type ProfileDiplomaLevel = Enums<"profiles_diploma_level">;

export const ROME_CODE_PATTERN = /^[A-Z]\d{4}$/;

export const OfferSearchParamsSchema = z.object({
  romeCodes: z.array(z.string().regex(ROME_CODE_PATTERN)).min(1).max(20),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().int().min(0).max(200),
  diplomaLevel: z.enum(["bac", "bac+2", "bac+3", "bac+4", "bac+5"]).nullable().optional(),
});
export type OfferSearchParams = z.input<typeof OfferSearchParamsSchema>;

/** An offer in our own vocabulary, ready to be stored in the offers table. */
export type NormalizedOffer = {
  source: OfferSource;
  /** Stable unique key within the source. */
  externalId: string;
  /** Identifier accepted by getOffer, when the source has one. */
  providerOfferId: string | null;
  title: string;
  description: string | null;
  /** Lower-case contract types, for example "apprentissage". */
  contractTypes: string[];
  /** Targeted European qualification level, 3 to 7. */
  diplomaLevel: number | null;
  companyName: string | null;
  companySiret: string | null;
  companyWebsite: string | null;
  /** True when a school manages the offer: company fields then describe the school. */
  isDelegated: boolean;
  locationLabel: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  inseeCode: string | null;
  romeCodes: string[];
  publishedAt: string | null;
  expiresAt: string | null;
  applyChannel: ApplyChannel;
  applyTarget: string;
  raw: Json;
};

export type ProviderWarning = { code: string; message: string };

export type OfferSearchResult = {
  offers: NormalizedOffer[];
  warnings: ProviderWarning[];
  /** Items dropped because they did not match the expected shape. */
  skipped: number;
};

export type ProviderCallOptions = { signal?: AbortSignal };

export interface OfferProvider {
  readonly source: OfferSource;
  search(params: OfferSearchParams, options?: ProviderCallOptions): Promise<OfferSearchResult>;
  getOffer(providerOfferId: string, options?: ProviderCallOptions): Promise<NormalizedOffer | null>;
}

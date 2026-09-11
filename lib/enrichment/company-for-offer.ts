import { logger } from "@/lib/logger";
import { extractPostalCode, JobOfferReadSchema } from "@/lib/providers/api-alternance";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

import { companyLookupKey, enrichCompany, type CompanyTarget } from "./enrich-company";

/** Company card of an offer, enriched on demand with the service role (server only). */

export type OfferForCompany = Pick<
  Tables<"offers">,
  | "company_siret"
  | "company_name"
  | "company_website"
  | "postal_code"
  | "location_label"
  | "is_delegated"
  | "raw"
>;

export type CompanyCardData =
  | { status: "delegated" | "unknown" | "not_found" | "low_confidence" | "unavailable" }
  | { status: "found"; company: Tables<"companies"> };

export function companyTargetFromOffer(offer: OfferForCompany): CompanyTarget | null {
  if (offer.is_delegated) return null;
  const job = JobOfferReadSchema.safeParse(offer.raw);
  return {
    siret: offer.company_siret,
    name: offer.company_name,
    postalCode:
      offer.postal_code ?? (offer.location_label ? extractPostalCode(offer.location_label) : null),
    website: offer.company_website ?? (job.success ? job.data.workplace.website : null),
    description: job.success ? job.data.workplace.description : null,
  };
}

export async function loadCompanyForOffer(
  offer: OfferForCompany,
  options: { now?: Date } = {},
): Promise<CompanyCardData> {
  // Offers managed by a school: the school is not the employer (docs/QUESTIONS.md C49).
  if (offer.is_delegated) return { status: "delegated" };
  const target = companyTargetFromOffer(offer);
  if (!target || !companyLookupKey(target)) return { status: "unknown" };
  const db = createAdminClient();
  try {
    const outcome = await enrichCompany(target, { db, now: options.now ?? new Date() });
    if (outcome.status === "skipped") return { status: "unknown" };
    if (outcome.status !== "found") return { status: outcome.status };
    const company = await db.from("companies").select("*").eq("siret", outcome.siret).maybeSingle();
    if (company.error || !company.data) return { status: "unavailable" };
    return { status: "found", company: company.data };
  } catch (error) {
    logger.warn("company_card_unavailable", { area: "enrichment", error });
    return { status: "unavailable" };
  }
}

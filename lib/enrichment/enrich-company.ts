import { DatabaseError } from "@/lib/errors";
import type { FetchLike } from "@/lib/http/fetch-json";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";

import { normalizeCompanyName, pickCompanyMatch, publicValue } from "./company-match";
import { buildCompanySummary } from "./company-summary";
import { headcountLabel, nafLabel } from "./labels";
import { searchCompanies, type CompanyRecord } from "./recherche-entreprises";
import { fetchCompanyWebsite, toSafeHttpUrl, type WebsiteResult } from "./website";

/**
 * enrich-company (brief section 6): registry data, then the website when the offer gives
 * one, then the rules summary, stored in `companies`. Every search, found or not, is kept
 * in `company_lookups` for 30 days (docs/API_RECHERCHE_ENTREPRISES.md section 11.3).
 */

export const COMPANY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CompanyTarget = {
  siret: string | null;
  name: string | null;
  postalCode: string | null;
  website: string | null;
  description: string | null;
};

export type EnrichOutcome =
  | { status: "found"; siret: string; cached: boolean }
  | { status: "not_found" | "low_confidence"; cached: boolean }
  | { status: "skipped" };

export function companyLookupKey(
  target: Pick<CompanyTarget, "siret" | "name" | "postalCode">,
): string | null {
  if (target.siret && /^\d{14}$/.test(target.siret)) return `siret:${target.siret}`;
  const name = target.name ? normalizeCompanyName(target.name) : "";
  if (name.length < 3) return null;
  return `name:${name}|${target.postalCode ?? ""}`;
}

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_match, separator: string, letter: string) => separator + letter.toUpperCase(),
    );

/** Operational executives who are natural persons: first name, name and role only (C12). */
export function publicExecutives(record: CompanyRecord): { name: string; role: string }[] {
  if (record.statut_diffusion === "P") return [];
  return record.dirigeants
    .flatMap((executive) => {
      if (executive.type_dirigeant !== "personne physique") return [];
      const role = publicValue(executive.qualite) ?? "";
      if (/commissaire aux comptes/i.test(role)) return [];
      const name = [publicValue(executive.prenoms)?.split(" ")[0], publicValue(executive.nom)]
        .filter((part): part is string => Boolean(part))
        .map(titleCase)
        .join(" ");
      return name ? [{ name, role: role || "Dirigeant" }] : [];
    })
    .slice(0, 5);
}

async function saveLookup(db: Db, row: TablesInsert<"company_lookups">): Promise<void> {
  const { error } = await db.from("company_lookups").upsert(row, { onConflict: "key" });
  if (error) throw new DatabaseError("company_lookups.upsert", error);
}

export async function enrichCompany(
  target: CompanyTarget,
  deps: {
    db: Db;
    now: Date;
    logger?: Logger;
    fetchImpl?: FetchLike;
    fetchWebsite?: (address: string) => Promise<WebsiteResult>;
    force?: boolean;
  },
): Promise<EnrichOutcome> {
  const key = companyLookupKey(target);
  if (!key) return { status: "skipped" };
  const { db, now } = deps;
  const log = (deps.logger ?? defaultLogger).child({
    task: "enrich_company",
    kind: key.split(":")[0],
  });

  const cached = await db
    .from("company_lookups")
    .select("siret, status, checked_at")
    .eq("key", key)
    .maybeSingle();
  if (cached.error) throw new DatabaseError("company_lookups.select", cached.error);
  const lookup = cached.data;
  if (
    !deps.force &&
    lookup &&
    now.getTime() - new Date(lookup.checked_at).getTime() < COMPANY_TTL_MS
  ) {
    if (lookup.status === "found" && lookup.siret)
      return { status: "found", siret: lookup.siret, cached: true };
    return {
      status: lookup.status === "low_confidence" ? "low_confidence" : "not_found",
      cached: true,
    };
  }

  const results = await searchCompanies(
    { siret: target.siret, name: target.name, postalCode: target.postalCode },
    { fetchImpl: deps.fetchImpl, logger: log },
  );
  const match = pickCompanyMatch(
    { siret: target.siret, name: target.name, postalCode: target.postalCode },
    results,
  );
  const checkedAt = now.toISOString();
  if (!match) {
    const status = results.length === 0 || target.siret ? "not_found" : "low_confidence";
    await saveLookup(db, { key, siret: null, status, confidence: null, checked_at: checkedAt });
    log.info("company_not_identified", { status, results: results.length });
    return { status, cached: false };
  }

  const { record, establishment, confidence } = match;
  const website = toSafeHttpUrl(target.website)?.toString() ?? null;
  const fetchWebsite =
    deps.fetchWebsite ??
    ((address: string) => fetchCompanyWebsite(address, { fetchImpl: deps.fetchImpl, logger: log }));
  const site = website ? await fetchWebsite(website) : null;
  const naf = record.activite_principale;
  const year = Number(record.date_creation?.slice(0, 4));
  const summary = buildCompanySummary({
    nafLabel: nafLabel(naf),
    headcountLabel: headcountLabel(record.tranche_effectif_salarie),
    creationYear: Number.isInteger(year) && year > 1800 ? year : null,
    city: publicValue(establishment.libelle_commune) ?? publicValue(record.siege?.libelle_commune),
    website:
      site?.status === "ok" ? { description: site.description, sources: site.sources } : null,
    offerDescription: target.description,
  });
  const raw = Object.fromEntries(
    Object.entries(record).filter(([field]) => field !== "dirigeants"),
  );
  const row: TablesInsert<"companies"> = {
    siret: establishment.siret,
    siren: record.siren,
    legal_name: publicValue(record.nom_raison_sociale) ?? publicValue(record.nom_complet),
    brand_name:
      publicValue(establishment.nom_commercial) ??
      publicValue(establishment.liste_enseignes[0]) ??
      publicValue(record.sigle),
    naf_code: naf,
    naf_label: nafLabel(naf),
    naf25_code: record.activite_principale_naf25,
    headcount_range: record.tranche_effectif_salarie,
    date_creation: record.date_creation,
    address: publicValue(record.siege?.adresse),
    postal_code: publicValue(record.siege?.code_postal),
    city: publicValue(record.siege?.libelle_commune),
    establishment_address: publicValue(establishment.adresse),
    establishment_postal_code: publicValue(establishment.code_postal),
    establishment_city: publicValue(establishment.libelle_commune),
    website,
    executives: publicExecutives(record) as Json,
    confidence,
    summary: summary as Json,
    summary_generated_at: checkedAt,
    source_updated_at: record.date_mise_a_jour
      ? new Date(record.date_mise_a_jour).toISOString()
      : null,
    raw: raw as Json,
  };
  const saved = await db.from("companies").upsert(row, { onConflict: "siret" });
  if (saved.error) throw new DatabaseError("companies.upsert", saved.error);
  await saveLookup(db, {
    key,
    siret: establishment.siret,
    status: "found",
    confidence,
    checked_at: checkedAt,
  });
  if (key !== `siret:${establishment.siret}`) {
    await saveLookup(db, {
      key: `siret:${establishment.siret}`,
      siret: establishment.siret,
      status: "found",
      confidence: 1,
      checked_at: checkedAt,
    });
  }
  log.info("company_enriched", { website: site?.status ?? "none", confidence });
  return { status: "found", siret: establishment.siret, cached: false };
}

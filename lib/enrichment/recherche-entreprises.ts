import { z } from "zod";

import { USER_AGENT } from "@/lib/brand";
import { getRechercheEntreprisesEnv } from "@/lib/env";
import { fetchJson, type FetchLike } from "@/lib/http/fetch-json";
import type { Logger } from "@/lib/logger";

/**
 * API Recherche d'entreprises (docs/API_RECHERCHE_ENTREPRISES.md): search by SIRET, or by
 * name and postal code. The schema is lenient and keeps only what the company card needs;
 * executives' birth dates and nationality are never parsed (section 12.3).
 */

const SOURCE = "recherche-entreprises";
const TIMEOUT_MS = 8_000;

const text = z
  .string()
  .nullish()
  .catch(null)
  .transform((value) => value ?? null);
const list = z
  .array(z.string())
  .nullish()
  .catch(null)
  .transform((value) => value ?? []);

export const EstablishmentSchema = z.object({
  siret: z.string().regex(/^\d{14}$/),
  adresse: text,
  code_postal: text,
  libelle_commune: text,
  activite_principale: text,
  tranche_effectif_salarie: text,
  etat_administratif: text,
  nom_commercial: text,
  liste_enseignes: list,
  statut_diffusion_etablissement: text,
});
export type Establishment = z.infer<typeof EstablishmentSchema>;

const ExecutiveSchema = z.object({
  type_dirigeant: text,
  nom: text,
  prenoms: text,
  qualite: text,
  denomination: text,
});

export const CompanyRecordSchema = z.object({
  siren: z.string().regex(/^\d{9}$/),
  nom_complet: text,
  nom_raison_sociale: text,
  sigle: text,
  activite_principale: text,
  activite_principale_naf25: text,
  categorie_entreprise: text,
  date_creation: text,
  date_mise_a_jour: text,
  date_mise_a_jour_rne: text,
  etat_administratif: text,
  tranche_effectif_salarie: text,
  statut_diffusion: text,
  siege: EstablishmentSchema.nullish()
    .catch(null)
    .transform((value) => value ?? null),
  matching_etablissements: z
    .array(z.unknown())
    .nullish()
    .catch(null)
    .transform((items) =>
      (items ?? []).flatMap((item) => {
        const parsed = EstablishmentSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  dirigeants: z
    .array(z.unknown())
    .nullish()
    .catch(null)
    .transform((items) =>
      (items ?? []).flatMap((item) => {
        const parsed = ExecutiveSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});
export type CompanyRecord = z.infer<typeof CompanyRecordSchema>;

const EnvelopeSchema = z.object({ results: z.array(z.unknown()) });

export async function searchCompanies(
  query: { siret?: string | null; name?: string | null; postalCode?: string | null },
  options: { baseUrl?: string; fetchImpl?: FetchLike; signal?: AbortSignal; logger?: Logger } = {},
): Promise<CompanyRecord[]> {
  const baseUrl = (
    options.baseUrl ?? getRechercheEntreprisesEnv().RECHERCHE_ENTREPRISES_BASE_URL
  ).replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/search`);
  if (query.siret && /^\d{14}$/.test(query.siret)) {
    url.searchParams.set("q", query.siret);
  } else if (query.name && query.name.trim().length >= 3) {
    url.searchParams.set("q", query.name.trim());
    if (query.postalCode && /^\d{5}$/.test(query.postalCode)) {
      url.searchParams.set("code_postal", query.postalCode);
    }
    url.searchParams.set("etat_administratif", "A");
  } else {
    return [];
  }
  url.searchParams.set("per_page", "5");
  url.searchParams.set("limite_matching_etablissements", "5");
  const { data } = await fetchJson({
    source: SOURCE,
    url,
    schema: EnvelopeSchema,
    headers: { "User-Agent": USER_AGENT },
    timeoutMs: TIMEOUT_MS,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
    logger: options.logger,
  });
  return data.results.flatMap((item) => {
    const parsed = CompanyRecordSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

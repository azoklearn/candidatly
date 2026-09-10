import { z } from "zod";

import { USER_AGENT } from "@/lib/brand";
import { getApiAlternanceEnv } from "@/lib/env";
import { ExternalApiError, ValidationError, toValidationIssues } from "@/lib/errors";
import { fetchJson, type FetchLike } from "@/lib/http/fetch-json";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Json } from "@/lib/supabase/database.types";

import {
  OfferSearchParamsSchema,
  ROME_CODE_PATTERN,
  type NormalizedOffer,
  type OfferProvider,
  type OfferSearchParams,
  type OfferSearchResult,
  type ProfileDiplomaLevel,
  type ProviderCallOptions,
} from "./types";

/**
 * API Alternance (La bonne alternance) provider: search and offer detail.
 * Reference: docs/API_ALTERNANCE.md. Sending applications is not implemented:
 * the account has no applications:write habilitation (docs/QUESTIONS.md A1, A3).
 */

const SOURCE = "api-alternance";
const DEFAULT_BASE_URL = "https://api.apprentissage.beta.gouv.fr/api";
const SEARCH_TIMEOUT_MS = 15_000;
const DETAIL_TIMEOUT_MS = 10_000;
const OFFER_ID_PATTERN = /^[0-9a-f]{24}$/i;

// Response schemas (docs/API_ALTERNANCE.md sections 6 to 8). Enumerations the API may
// extend (contract type, remote mode, status, diploma level) are read as plain strings.
const GeoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const JobOfferReadSchema = z.object({
  identifier: z.object({
    id: z.string().nullable(),
    partner_job_id: z.string().min(1),
    partner_label: z.string().min(1),
  }),
  workplace: z.object({
    name: z.string().nullable(),
    description: z.string().nullable(),
    website: z.string().nullable(),
    siret: z.string().nullable(),
    brand: z.string().nullable(),
    legal_name: z.string().nullable(),
    size: z.string().nullable(),
    location: z.object({ address: z.string(), geopoint: GeoPointSchema }),
    domain: z.object({
      idcc: z.number().nullable(),
      opco: z.string().nullable(),
      naf: z.object({ code: z.string(), label: z.string().nullable() }).nullable(),
    }),
  }),
  apply: z.object({
    phone: z.string().nullable(),
    url: z.string().min(1),
    recipient_id: z.string().nullable().optional(),
  }),
  contract: z.object({
    start: z.string().nullable(),
    duration: z.number().nullable(),
    type: z.array(z.string()),
    remote: z.string().nullable(),
  }),
  offer: z.object({
    title: z.string().min(1),
    description: z.string(),
    desired_skills: z.array(z.string()),
    to_be_acquired_skills: z.array(z.string()),
    access_conditions: z.array(z.string()),
    opening_count: z.number(),
    publication: z.object({ creation: z.string().nullable(), expiration: z.string().nullable() }),
    rome_codes: z.array(z.string()),
    target_diploma: z.object({ european: z.string(), label: z.string() }).nullable(),
    status: z.string(),
  }),
  is_delegated: z.boolean(),
});
export type JobOfferRead = z.infer<typeof JobOfferReadSchema>;

const SearchResponseSchema = z.object({
  jobs: z.array(z.unknown()),
  recruiters: z.array(z.unknown()),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
});

const EUROPEAN_LEVEL_BY_DIPLOMA: Record<ProfileDiplomaLevel, string> = {
  bac: "4",
  "bac+2": "5",
  "bac+3": "6",
  "bac+4": "6",
  "bac+5": "7",
};

/** Profile level (diploma prepared during the apprenticeship) to target_diploma_level (C6). */
export function toTargetDiplomaLevel(level: ProfileDiplomaLevel | null | undefined): string | null {
  return level ? EUROPEAN_LEVEL_BY_DIPLOMA[level] : null;
}

/** Last five-digit group of a French postal address, for example "20 AVENUE DE SEGUR 75007 PARIS". */
export function extractPostalCode(address: string): string | null {
  return address.match(/\b\d{5}\b/g)?.at(-1) ?? null;
}

function parseEuropeanLevel(value: string | undefined): number | null {
  const level = Number(value);
  return Number.isInteger(level) && level >= 3 && level <= 7 ? level : null;
}

function cleanSiret(value: string | null): string | null {
  const digits = value?.replace(/\s/g, "") ?? "";
  return /^\d{14}$/.test(digits) ? digits : null;
}

function cleanHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeJobOffer(job: JobOfferRead, raw: Json): NormalizedOffer {
  const [lng, lat] = job.workplace.location.geopoint.coordinates;
  const hasValidPoint = lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const recipientId = emptyToNull(job.apply.recipient_id ?? null);

  return {
    source: "api_alternance",
    externalId: `${job.identifier.partner_label}:${job.identifier.partner_job_id}`,
    providerOfferId: job.identifier.id,
    title: job.offer.title.trim(),
    description: emptyToNull(job.offer.description),
    contractTypes: [...new Set(job.contract.type.map((type) => type.trim().toLowerCase()))],
    diplomaLevel: parseEuropeanLevel(job.offer.target_diploma?.european),
    companyName:
      emptyToNull(job.workplace.name) ??
      emptyToNull(job.workplace.legal_name) ??
      emptyToNull(job.workplace.brand),
    companySiret: cleanSiret(job.workplace.siret),
    companyWebsite: cleanHttpUrl(job.workplace.website),
    isDelegated: job.is_delegated,
    locationLabel: emptyToNull(job.workplace.location.address),
    postalCode: extractPostalCode(job.workplace.location.address),
    lat: hasValidPoint ? lat : null,
    lng: hasValidPoint ? lng : null,
    inseeCode: null,
    romeCodes: job.offer.rome_codes.filter((code) => ROME_CODE_PATTERN.test(code)),
    publishedAt: toIsoDate(job.offer.publication.creation),
    expiresAt: toIsoDate(job.offer.publication.expiration),
    applyChannel: recipientId ? "api_alternance" : "external_url",
    applyTarget: recipientId ?? job.apply.url,
    raw,
  };
}

export type ApiAlternanceProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  logger?: Logger;
  /** Retries per GET request, on network errors, 429 and 5xx. */
  maxRetries?: number;
};

export class ApiAlternanceProvider implements OfferProvider {
  readonly source = "api_alternance" as const;
  private readonly baseUrl: string;
  private readonly log: Logger;

  constructor(private readonly options: ApiAlternanceProviderOptions) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.log = (options.logger ?? defaultLogger).child({ provider: SOURCE });
  }

  async search(
    params: OfferSearchParams,
    { signal }: ProviderCallOptions = {},
  ): Promise<OfferSearchResult> {
    const parsed = OfferSearchParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new ValidationError(
        "Invalid offer search parameters",
        toValidationIssues(parsed.error),
      );
    }
    const { romeCodes, latitude, longitude, radiusKm, diplomaLevel } = parsed.data;

    const url = new URL(`${this.baseUrl}/job/v1/search`);
    url.searchParams.set("romes", [...new Set(romeCodes)].join(","));
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("radius", String(radiusKm));
    const targetLevel = toTargetDiplomaLevel(diplomaLevel);
    if (targetLevel) url.searchParams.set("target_diploma_level", targetLevel);

    const { data } = await fetchJson({
      ...this.requestOptions(signal),
      url,
      schema: SearchResponseSchema,
      timeoutMs: SEARCH_TIMEOUT_MS,
    });

    const offers: NormalizedOffer[] = [];
    let skipped = 0;
    for (const item of data.jobs) {
      const job = JobOfferReadSchema.safeParse(item);
      if (!job.success) {
        skipped++;
        this.log.warn("job_skipped", { issues: toValidationIssues(job.error).slice(0, 5) });
        continue;
      }
      offers.push(normalizeJobOffer(job.data, item as Json));
    }

    this.log.info("search_completed", {
      romeCodes: romeCodes.length,
      radiusKm,
      offers: offers.length,
      skipped,
      recruiters: data.recruiters.length,
      warnings: data.warnings.map((warning) => warning.code),
    });
    return { offers, warnings: data.warnings, skipped };
  }

  async getOffer(
    providerOfferId: string,
    { signal }: ProviderCallOptions = {},
  ): Promise<NormalizedOffer | null> {
    if (!OFFER_ID_PATTERN.test(providerOfferId)) {
      throw new ValidationError("Invalid API Alternance offer id", [
        { path: "providerOfferId", message: "Expected a 24-character hexadecimal identifier" },
      ]);
    }
    try {
      const { data } = await fetchJson({
        ...this.requestOptions(signal),
        url: new URL(`${this.baseUrl}/job/v1/offer/${providerOfferId}`),
        schema: z.unknown(),
        timeoutMs: DETAIL_TIMEOUT_MS,
      });
      const job = JobOfferReadSchema.safeParse(data);
      if (!job.success) {
        throw new ExternalApiError(SOURCE, "Unexpected offer shape", {
          status: 200,
          issues: toValidationIssues(job.error),
        });
      }
      return normalizeJobOffer(job.data, data as Json);
    } catch (error) {
      if (error instanceof ExternalApiError && error.status === 404) return null;
      throw error;
    }
  }

  private requestOptions(signal: AbortSignal | undefined) {
    return {
      source: SOURCE,
      headers: { Authorization: `Bearer ${this.options.apiKey}`, "User-Agent": USER_AGENT },
      signal,
      fetchImpl: this.options.fetchImpl,
      sleep: this.options.sleep,
      logger: this.log,
      retry:
        this.options.maxRetries === undefined ? undefined : { maxRetries: this.options.maxRetries },
    };
  }
}

/** Provider configured from the environment (server side only). */
export function createApiAlternanceProvider(
  overrides: Partial<ApiAlternanceProviderOptions> = {},
): ApiAlternanceProvider {
  const env = getApiAlternanceEnv();
  return new ApiAlternanceProvider({
    apiKey: env.API_ALTERNANCE_KEY,
    baseUrl: env.API_ALTERNANCE_BASE_URL,
    ...overrides,
  });
}

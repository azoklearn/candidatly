import { z } from "zod";

import { USER_AGENT } from "@/lib/brand";
import { getGeocodingEnv } from "@/lib/env";
import { fetchJson, type FetchLike } from "@/lib/http/fetch-json";

/**
 * Address search on the Géoplateforme geocoder (docs/API_ADRESSE.md).
 * Coordinates come from geometry.coordinates in [longitude, latitude] order;
 * the x and y properties are Lambert-93 and never used.
 */

const SOURCE = "geocoding";
const TIMEOUT_MS = 5_000;

const FeatureSchema = z.object({
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    label: z.string().min(1),
    score: z.number(),
    type: z.string(),
    citycode: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
    context: z.string().optional(),
  }),
});

const SearchResponseSchema = z.object({ features: z.array(z.unknown()) });

export type PlaceType = "municipality" | "housenumber" | "street" | "locality";

export type GeocodedPlace = {
  label: string;
  lat: number;
  lng: number;
  citycode: string | null;
  postcode: string | null;
  city: string | null;
  context: string | null;
  type: string;
  score: number;
};

export type SearchPlacesOptions = {
  limit?: number;
  type?: PlaceType;
  /** true while the user types, false to resolve a complete label. */
  autocomplete?: boolean;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
};

/** The API accepts 3 to 200 characters starting with a letter or a digit. */
export function isSearchableQuery(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.length >= 3 && trimmed.length <= 200 && /^[\p{L}\p{N}]/u.test(trimmed);
}

function toPlace(item: unknown): GeocodedPlace[] {
  const feature = FeatureSchema.safeParse(item);
  if (!feature.success) return [];
  const [lng, lat] = feature.data.geometry.coordinates;
  const { properties } = feature.data;
  return [
    {
      label: properties.label,
      lat,
      lng,
      citycode: properties.citycode ?? null,
      postcode: properties.postcode ?? null,
      city: properties.city ?? null,
      context: properties.context ?? null,
      type: properties.type,
      score: properties.score,
    },
  ];
}

export async function searchPlaces(
  query: string,
  options: SearchPlacesOptions = {},
): Promise<GeocodedPlace[]> {
  if (!isSearchableQuery(query)) return [];
  const baseUrl = (options.baseUrl ?? getGeocodingEnv().GEOCODING_API_BASE_URL).replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/search`);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", String(Math.min(Math.max(options.limit ?? 5, 1), 10)));
  url.searchParams.set("autocomplete", options.autocomplete === false ? "0" : "1");
  if (options.type) url.searchParams.set("type", options.type);

  const { data } = await fetchJson({
    source: SOURCE,
    url,
    schema: SearchResponseSchema,
    headers: { "User-Agent": USER_AGENT },
    timeoutMs: TIMEOUT_MS,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
    retry: { maxRetries: 1 },
  });
  // The geocoder sometimes returns the same place twice (seen with "Lyon").
  const seen = new Set<string>();
  return data.features.flatMap(toPlace).filter((place) => {
    const key = `${place.label}|${place.citycode ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Server-side check of a place chosen in the browser (docs/QUESTIONS.md C26):
 * the label is geocoded again and must resolve to the same city code.
 */
export async function resolvePlace(
  choice: { label: string; citycode: string },
  options: Omit<SearchPlacesOptions, "autocomplete" | "limit"> = {},
): Promise<GeocodedPlace | null> {
  const [best] = await searchPlaces(choice.label, { ...options, autocomplete: false, limit: 1 });
  return best && best.citycode === choice.citycode ? best : null;
}

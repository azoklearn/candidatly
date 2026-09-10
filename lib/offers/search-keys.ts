import type { OfferSearchParams, ProfileDiplomaLevel } from "@/lib/providers/types";

/**
 * One external search per distinct (ROME codes, zone, radius, level) combination
 * active among users (brief section 6, sync-offers). Coordinates are rounded to
 * 0.01 degree (about 1 km) so neighbours share the same search and cache entry.
 */

export type ProfileForSearch = {
  userId: string;
  romeCodes: string[];
  lat: number;
  lng: number;
  radiusKm: number;
  diplomaLevel: ProfileDiplomaLevel | null;
};

export type SearchKey = { key: string; params: OfferSearchParams; userIds: string[] };

const round2 = (value: number) => Math.round(value * 100) / 100;

export function toSearchKey(profile: Omit<ProfileForSearch, "userId">): Omit<SearchKey, "userIds"> {
  const romeCodes = [...new Set(profile.romeCodes)].sort();
  const params: OfferSearchParams = {
    romeCodes,
    latitude: round2(profile.lat),
    longitude: round2(profile.lng),
    radiusKm: Math.min(200, Math.max(1, Math.round(profile.radiusKm))),
    diplomaLevel: profile.diplomaLevel,
  };
  const key = [
    `rome=${romeCodes.join(",")}`,
    `lat=${params.latitude.toFixed(2)}`,
    `lng=${params.longitude.toFixed(2)}`,
    `r=${params.radiusKm}`,
    `level=${profile.diplomaLevel ?? "any"}`,
  ].join("|");
  return { key, params };
}

export function groupSearchKeys(profiles: ProfileForSearch[]): SearchKey[] {
  const byKey = new Map<string, SearchKey>();
  for (const profile of profiles) {
    if (profile.romeCodes.length === 0) continue;
    const { key, params } = toSearchKey(profile);
    const existing = byKey.get(key);
    if (existing) existing.userIds.push(profile.userId);
    else byKey.set(key, { key, params, userIds: [profile.userId] });
  }
  return [...byKey.values()];
}

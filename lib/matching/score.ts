import { tokenize } from "@/lib/text/french";
import { toTargetDiplomaLevel } from "@/lib/providers/api-alternance";
import type { ProfileDiplomaLevel } from "@/lib/providers/types";

/**
 * Match score from 0 to 100 between a profile and an offer (brief section 6, compute-matches):
 * ROME match, distance, diploma level, freshness, CV keywords found in the offer.
 * Offers outside the search radius, or without coordinates, are not matched at all.
 */

export const WEIGHTS = {
  rome: 35,
  distance: 25,
  diploma: 15,
  freshness: 10,
  keywords: 15,
} as const;
const FRESH_DAYS = 7;
const STALE_DAYS = 60;
const KEYWORDS_FOR_FULL_SCORE = 5;

export type MatchProfile = {
  romeCodes: string[];
  lat: number;
  lng: number;
  radiusKm: number;
  diplomaLevel: ProfileDiplomaLevel | null;
  cvKeywords: string[];
};

export type MatchOffer = {
  romeCodes: string[];
  lat: number | null;
  lng: number | null;
  /** European level 3 to 7. */
  diplomaLevel: number | null;
  publishedAt: string | null;
  /** Title, description and skills, used for keywords. */
  text: string;
};

export type ScoreReasons = {
  rome: "exact" | "related" | "none";
  distanceKm: number;
  diploma: "exact" | "unspecified" | "adjacent" | "mismatch";
  freshnessDays: number | null;
  keywords: string[];
  points: Record<keyof typeof WEIGHTS, number>;
};

export type MatchScore = { score: number; reasons: ScoreReasons };

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Most frequent meaningful words of a CV, used to spot them in offers. */
export function extractKeywords(cvText: string, max = 40): string[] {
  const counts = new Map<string, number>();
  for (const word of tokenize(cvText, 3)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([word]) => word);
}

function romePoints(profileCodes: string[], offerCodes: string[]): [number, ScoreReasons["rome"]] {
  if (offerCodes.some((code) => profileCodes.includes(code))) return [WEIGHTS.rome, "exact"];
  const domains = new Set(profileCodes.map((code) => code.slice(0, 3)));
  if (offerCodes.some((code) => domains.has(code.slice(0, 3)))) {
    return [Math.round(WEIGHTS.rome / 2), "related"];
  }
  return [0, "none"];
}

function diplomaPoints(
  level: ProfileDiplomaLevel | null,
  offerLevel: number | null,
): [number, ScoreReasons["diploma"]] {
  const target = Number(toTargetDiplomaLevel(level));
  if (offerLevel === null || !Number.isInteger(target) || target === 0) {
    return [Math.round(WEIGHTS.diploma * 0.6), "unspecified"];
  }
  const gap = Math.abs(offerLevel - target);
  if (gap === 0) return [WEIGHTS.diploma, "exact"];
  if (gap === 1) return [Math.round(WEIGHTS.diploma * 0.4), "adjacent"];
  return [0, "mismatch"];
}

function freshnessPoints(publishedAt: string | null, now: Date): [number, number | null] {
  if (!publishedAt) return [Math.round(WEIGHTS.freshness / 2), null];
  const days = Math.max(0, (now.getTime() - new Date(publishedAt).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return [Math.round(WEIGHTS.freshness / 2), null];
  const ratio =
    days <= FRESH_DAYS ? 1 : Math.max(0, 1 - (days - FRESH_DAYS) / (STALE_DAYS - FRESH_DAYS));
  return [Math.round(WEIGHTS.freshness * ratio), Math.floor(days)];
}

export function scoreMatch(
  profile: MatchProfile,
  offer: MatchOffer,
  now: Date = new Date(),
): MatchScore | null {
  if (offer.lat === null || offer.lng === null) return null;
  const distanceKm = haversineKm(profile, { lat: offer.lat, lng: offer.lng });
  if (distanceKm > profile.radiusKm) return null;

  const [rome, romeReason] = romePoints(profile.romeCodes, offer.romeCodes);
  const distance = Math.round(
    5 + (WEIGHTS.distance - 5) * (1 - distanceKm / Math.max(profile.radiusKm, 1)),
  );
  const [diploma, diplomaReason] = diplomaPoints(profile.diplomaLevel, offer.diplomaLevel);
  const [freshness, freshnessDays] = freshnessPoints(offer.publishedAt, now);
  const offerWords = new Set(tokenize(offer.text, 3));
  const found = profile.cvKeywords.filter((word) => offerWords.has(word));
  const keywords = Math.round(
    WEIGHTS.keywords * Math.min(1, found.length / KEYWORDS_FOR_FULL_SCORE),
  );

  const points = { rome, distance, diploma, freshness, keywords };
  const score = Math.min(100, Math.max(0, rome + distance + diploma + freshness + keywords));
  return {
    score,
    reasons: {
      rome: romeReason,
      distanceKm: Math.round(distanceKm * 10) / 10,
      diploma: diplomaReason,
      freshnessDays,
      keywords: found.slice(0, 8),
      points,
    },
  };
}

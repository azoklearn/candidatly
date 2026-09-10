import { DatabaseError } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";
import type { TablesInsert } from "@/lib/supabase/database.types";

import { extractKeywords, scoreMatch, type MatchProfile } from "./score";

/** compute-matches (brief section 6): scores the live offers around a user and stores matches. */

const MAX_OFFERS = 2_000;
const CHUNK = 200;

export type OfferForMatching = {
  id: string;
  rome_codes: string[];
  lat: number | null;
  lng: number | null;
  diploma_level: number | null;
  published_at: string | null;
  title: string;
  description: string | null;
};

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/** Rows for the matches table. Offers without any ROME link to the profile are never proposed. */
export function buildMatchRows(
  userId: string,
  profile: MatchProfile,
  offers: OfferForMatching[],
  now: Date,
): TablesInsert<"matches">[] {
  return offers.flatMap((offer) => {
    const result = scoreMatch(
      profile,
      {
        romeCodes: offer.rome_codes,
        lat: offer.lat,
        lng: offer.lng,
        diplomaLevel: offer.diploma_level,
        publishedAt: offer.published_at,
        text: `${offer.title}\n${offer.description ?? ""}`,
      },
      now,
    );
    if (!result || result.reasons.rome === "none") return [];
    return [
      { user_id: userId, offer_id: offer.id, score: result.score, score_reasons: result.reasons },
    ];
  });
}

export type ComputeResult = { matched: number; removed: number };

export async function computeMatchesForUser(options: {
  db: Db;
  userId: string;
  now: Date;
  logger?: Logger;
}): Promise<ComputeResult> {
  const { db, userId, now } = options;
  const log = (options.logger ?? defaultLogger).child({ task: "compute_matches", userId });

  const profile = await db
    .from("profiles")
    .select("rome_codes, location_lat, location_lng, search_radius_km, diploma_level")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  const p = profile.data;
  if (!p || p.location_lat === null || p.location_lng === null || p.rome_codes.length === 0) {
    return { matched: 0, removed: 0 };
  }

  const cv = await db
    .from("documents")
    .select("extracted_text")
    .eq("user_id", userId)
    .eq("kind", "cv")
    .eq("is_current", true)
    .maybeSingle();
  if (cv.error) throw new DatabaseError("documents.select", cv.error);

  const box = boundingBox(p.location_lat, p.location_lng, p.search_radius_km);
  const offers = await db
    .from("offers")
    .select("id, rome_codes, lat, lng, diploma_level, published_at, title, description")
    .is("removed_at", null)
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .limit(MAX_OFFERS);
  if (offers.error) throw new DatabaseError("offers.select", offers.error);

  const rows = buildMatchRows(
    userId,
    {
      romeCodes: p.rome_codes,
      lat: p.location_lat,
      lng: p.location_lng,
      radiusKm: p.search_radius_km,
      diplomaLevel: p.diploma_level,
      cvKeywords: extractKeywords(cv.data?.extracted_text ?? ""),
    },
    offers.data,
    now,
  );
  for (let i = 0; i < rows.length; i += CHUNK) {
    // status is not in the payload: saved or dismissed offers keep their status.
    const { error } = await db
      .from("matches")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "user_id,offer_id" });
    if (error) throw new DatabaseError("matches.upsert", error);
  }

  // Proposals the student has not acted on and that no longer fit are withdrawn.
  const existing = await db
    .from("matches")
    .select("id, offer_id")
    .eq("user_id", userId)
    .eq("status", "new");
  if (existing.error) throw new DatabaseError("matches.select", existing.error);
  const kept = new Set(rows.map((row) => row.offer_id));
  const obsolete = existing.data
    .filter((match) => !kept.has(match.offer_id))
    .map((match) => match.id);
  for (let i = 0; i < obsolete.length; i += CHUNK) {
    const { error } = await db
      .from("matches")
      .delete()
      .in("id", obsolete.slice(i, i + CHUNK));
    if (error) throw new DatabaseError("matches.delete", error);
  }

  log.info("matches_computed", {
    offers: offers.data.length,
    matched: rows.length,
    removed: obsolete.length,
  });
  return { matched: rows.length, removed: obsolete.length };
}

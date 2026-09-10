import { DatabaseError } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import { computeMatchesForUser, type ComputeResult } from "@/lib/matching/compute";
import type { OfferProvider } from "@/lib/providers/types";

import { toSearchKey } from "./search-keys";
import { syncSearchKey, type Db, type SyncResult } from "./sync";

/** Fetches the offers of one user's search (cache permitting) then recomputes their matches. */
export async function refreshOffersForUser(options: {
  db: Db;
  provider: OfferProvider;
  userId: string;
  now: Date;
  force?: boolean;
  logger?: Logger;
}): Promise<{ sync: SyncResult | null; matches: ComputeResult }> {
  const { db, userId } = options;
  const profile = await db
    .from("profiles")
    .select("rome_codes, location_lat, location_lng, search_radius_km, diploma_level")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  const p = profile.data;
  if (!p || p.location_lat === null || p.location_lng === null || p.rome_codes.length === 0) {
    return { sync: null, matches: { matched: 0, removed: 0 } };
  }
  const searchKey = toSearchKey({
    romeCodes: p.rome_codes,
    lat: p.location_lat,
    lng: p.location_lng,
    radiusKm: p.search_radius_km,
    diplomaLevel: p.diploma_level,
  });
  const logger = options.logger ?? defaultLogger;
  const sync = await syncSearchKey({ ...options, searchKey, logger });
  const matches = await computeMatchesForUser({ ...options, logger });
  return { sync, matches };
}

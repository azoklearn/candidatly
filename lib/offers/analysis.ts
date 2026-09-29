import { DatabaseError } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import { boundingBox } from "@/lib/matching/compute";
import { scoreMatch } from "@/lib/matching/score";
import type { OfferProvider, ProfileDiplomaLevel } from "@/lib/providers/types";

import { toSearchKey } from "./search-keys";
import { syncSearchKey, type Db } from "./sync";

/**
 * What the analysis screen counts (docs/QUESTIONS.md C94), before the account exists: the
 * search of the questionnaire is run once, then the live offers that really match are
 * counted, plus the companies known to hire nearby. Every figure comes from the database.
 */

const MAX_OFFERS = 2_000;

export type AnalysisProfile = {
  romeCodes: string[];
  lat: number;
  lng: number;
  radiusKm: number;
  diplomaLevel: ProfileDiplomaLevel | null;
};

export type AnalysisCounts = { offers: number; companies: number };

export async function analyseSearch(options: {
  db: Db;
  provider: OfferProvider;
  profile: AnalysisProfile;
  now: Date;
  /** False when the visitor hit the rate limit: only the cache is read, nothing is fetched. */
  allowSearch?: boolean;
  logger?: Logger;
}): Promise<AnalysisCounts> {
  const { db, profile, now } = options;
  const log = (options.logger ?? defaultLogger).child({ task: "analyse_search" });
  const searchKey = toSearchKey(profile);

  if (options.allowSearch !== false) {
    try {
      await syncSearchKey({ ...options, searchKey, logger: log });
    } catch (error) {
      // The screen still shows what the cache holds: a search outage is not a dead end.
      log.warn("analysis_search_failed", { error });
    }
  }

  const box = boundingBox(profile.lat, profile.lng, profile.radiusKm);
  const offers = await db
    .from("offers")
    .select("rome_codes, lat, lng, diploma_level, published_at, title, description")
    .is("removed_at", null)
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .limit(MAX_OFFERS);
  if (offers.error) throw new DatabaseError("offers.select", offers.error);

  const matched = offers.data.filter((offer) => {
    const result = scoreMatch(
      { ...profile, cvKeywords: [] },
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
    return result !== null && result.reasons.rome !== "none";
  }).length;

  const companies = await db
    .from("hiring_companies")
    .select("id", { count: "exact", head: true })
    .eq("query_key", searchKey.key);
  if (companies.error) log.warn("hiring_companies_count_failed", { code: companies.error.code });

  log.info("analysis_done", { offers: matched, companies: companies.count ?? 0 });
  return { offers: matched, companies: companies.count ?? 0 };
}

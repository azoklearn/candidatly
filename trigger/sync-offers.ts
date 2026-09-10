import { schedules } from "@trigger.dev/sdk";

import { ExternalApiError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { groupSearchKeys } from "@/lib/offers/search-keys";
import { markStaleOffers, syncSearchKey } from "@/lib/offers/sync";
import { createApiAlternanceProvider } from "@/lib/providers/api-alternance";
import { createAdminClient } from "@/lib/supabase/admin";

import { computeMatches } from "./compute-matches";

/** Stays under the API Alternance limit of 60 searches per minute. */
const PAUSE_BETWEEN_SEARCHES_MS = 1_100;
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, PAUSE_BETWEEN_SEARCHES_MS));

/**
 * sync-offers (brief section 6), every 6 hours: one search per distinct combination
 * of ROME codes and zone among onboarded users, logical deletion of stale offers,
 * then compute-matches for every user concerned.
 */
export const syncOffers = schedules.task({
  id: "sync-offers",
  cron: { pattern: "0 */6 * * *", timezone: "Europe/Paris" },
  maxDuration: 900,
  run: async (payload) => {
    const log = logger.child({ task: "sync-offers" });
    const db = createAdminClient();
    const provider = createApiAlternanceProvider({ logger: log });
    const now = payload.timestamp;

    const profiles = await db
      .from("profiles")
      .select("user_id, rome_codes, location_lat, location_lng, search_radius_km, diploma_level")
      .eq("onboarding_completed", true);
    if (profiles.error) throw new Error(`profiles.select: ${profiles.error.message}`);

    const keys = groupSearchKeys(
      profiles.data.flatMap((p) =>
        p.location_lat === null || p.location_lng === null
          ? []
          : [
              {
                userId: p.user_id,
                romeCodes: p.rome_codes,
                lat: p.location_lat,
                lng: p.location_lng,
                radiusKm: p.search_radius_km,
                diplomaLevel: p.diploma_level,
              },
            ],
      ),
    );

    let synced = 0;
    let cached = 0;
    let failed = 0;
    for (const key of keys) {
      try {
        const result = await syncSearchKey({ db, provider, searchKey: key, now, logger: log });
        if (result.skipped) cached++;
        else {
          synced++;
          await pause();
        }
      } catch (error) {
        failed++;
        log.error("search_failed", {
          key: key.key,
          status: error instanceof ExternalApiError ? error.status : null,
          error,
        });
      }
    }

    const stale = await markStaleOffers(db, now);
    const userIds = [...new Set(keys.flatMap((key) => key.userIds))];
    if (userIds.length > 0) {
      await computeMatches.batchTrigger(
        userIds.map((userId) => ({
          payload: { userId },
          options: { idempotencyKey: `compute-matches:${userId}:${now.toISOString()}` },
        })),
      );
    }

    const summary = { keys: keys.length, synced, cached, failed, stale, users: userIds.length };
    log.info("sync_completed", summary);
    return summary;
  },
});

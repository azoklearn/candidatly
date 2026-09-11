import { DatabaseError, ExternalApiError } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import { computeMatchesForUser } from "@/lib/matching/compute";
import type { OfferProvider } from "@/lib/providers/types";

import { groupSearchKeys } from "./search-keys";
import { SEARCH_TTL_MS, markStaleOffers, syncSearchKey, type Db } from "./sync";

/**
 * Background offer sync (brief section 6, docs/QUESTIONS.md B10). Supabase Cron calls
 * app/api/cron/sync-offers every 15 minutes; each call refreshes a bounded batch of the
 * searches older than 6 hours, recomputes the matches of their users, then marks stale
 * offers as removed.
 */

export const MAX_SEARCHES_PER_RUN = 25;
export const TIME_BUDGET_MS = 40_000;
/** Stays well under the API Alternance limit of 60 searches per minute. */
const PAUSE_BETWEEN_SEARCHES_MS = 1_100;

/** Searches never run come first, then the oldest; searches younger than 6 hours are left out. */
export function pickDueKeys<T extends { key: string }>(
  keys: T[],
  lastRunAt: Map<string, string>,
  now: Date,
  max: number,
): T[] {
  const age = (key: string) => {
    const last = lastRunAt.get(key);
    return last ? now.getTime() - new Date(last).getTime() : Number.POSITIVE_INFINITY;
  };
  return keys
    .filter((item) => age(item.key) >= SEARCH_TTL_MS)
    .sort((a, b) => {
      const ageA = age(a.key);
      const ageB = age(b.key);
      return ageA === ageB ? 0 : ageA > ageB ? -1 : 1;
    })
    .slice(0, max);
}

export type ScheduledSyncSummary = {
  keys: number;
  due: number;
  synced: number;
  failed: number;
  remaining: number;
  users: number;
  stale: number;
};

export async function runScheduledSync(options: {
  db: Db;
  provider: OfferProvider;
  now: Date;
  logger?: Logger;
  maxSearches?: number;
  timeBudgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}): Promise<ScheduledSyncSummary> {
  const { db, provider, now } = options;
  const log = (options.logger ?? defaultLogger).child({ task: "scheduled_sync" });
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const clock = options.clock ?? Date.now;
  const startedAt = clock();
  const budget = options.timeBudgetMs ?? TIME_BUDGET_MS;

  const profiles = await db
    .from("profiles")
    .select("user_id, rome_codes, location_lat, location_lng, search_radius_km, diploma_level")
    .eq("onboarding_completed", true);
  if (profiles.error) throw new DatabaseError("profiles.select", profiles.error);
  const keys = groupSearchKeys(
    profiles.data.flatMap((p) =>
      p.location_lat === null || p.location_lng === null || p.rome_codes.length === 0
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

  // Most recent successful run per search. A search missing from this page of results
  // is old, hence due: the outcome stays right even when the history is long.
  const lastRunAt = new Map<string, string>();
  if (keys.length > 0) {
    const runs = await db
      .from("offer_search_runs")
      .select("query_key, fetched_at")
      .eq("source", provider.source)
      .eq("status_code", 200)
      .in(
        "query_key",
        keys.map((key) => key.key),
      )
      .order("fetched_at", { ascending: false });
    if (runs.error) throw new DatabaseError("offer_search_runs.select", runs.error);
    for (const run of runs.data) {
      if (!lastRunAt.has(run.query_key)) lastRunAt.set(run.query_key, run.fetched_at);
    }
  }

  const allDue = pickDueKeys(keys, lastRunAt, now, Number.POSITIVE_INFINITY);
  const batch = allDue.slice(0, options.maxSearches ?? MAX_SEARCHES_PER_RUN);
  let synced = 0;
  let failed = 0;
  const users = new Set<string>();
  for (const [index, key] of batch.entries()) {
    if (clock() - startedAt > budget) break;
    if (index > 0) await sleep(PAUSE_BETWEEN_SEARCHES_MS);
    try {
      await syncSearchKey({ db, provider, searchKey: key, now, force: true, logger: log });
      synced++;
      for (const userId of key.userIds) {
        await computeMatchesForUser({ db, userId, now, logger: log });
        users.add(userId);
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
  const summary: ScheduledSyncSummary = {
    keys: keys.length,
    due: allDue.length,
    synced,
    failed,
    remaining: allDue.length - synced - failed,
    users: users.size,
    stale,
  };
  log.info("scheduled_sync_completed", summary);
  return summary;
}

import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError, ExternalApiError } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import { toOfferRow } from "@/lib/providers/to-offer-row";
import type { OfferProvider } from "@/lib/providers/types";
import type { Database, Json } from "@/lib/supabase/database.types";

import type { SearchKey } from "./search-keys";

/** Offer cache (brief sections 3.1 and 6): 6 h per search, logical deletion of stale offers. */

export type Db = SupabaseClient<Database>;

export const SEARCH_TTL_MS = 6 * 60 * 60 * 1000;
/** An offer not returned by any search for 3 days is considered gone (docs/QUESTIONS.md C17). */
export const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const UPSERT_CHUNK = 200;

type SearchRun = { fetched_at: string; status_code: number | null };

export function isRunFresh(run: SearchRun | null, now: Date): boolean {
  return (
    run !== null &&
    run.status_code === 200 &&
    now.getTime() - new Date(run.fetched_at).getTime() < SEARCH_TTL_MS
  );
}

/**
 * The API sometimes returns the same offer twice in one response (every France Travail
 * offer of a Paris search on 11 September 2026), and one upsert cannot touch a row twice.
 */
export function uniqueByExternalId<T extends { external_id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.external_id)) return false;
    seen.add(row.external_id);
    return true;
  });
}

export type SyncResult = { key: string; skipped: boolean; offers: number; invalidItems: number };

export async function syncSearchKey(options: {
  db: Db;
  provider: OfferProvider;
  searchKey: Pick<SearchKey, "key" | "params">;
  now: Date;
  force?: boolean;
  logger?: Logger;
}): Promise<SyncResult> {
  const { db, provider, searchKey, now } = options;
  const log = (options.logger ?? defaultLogger).child({ task: "sync_offers", key: searchKey.key });

  const last = await db
    .from("offer_search_runs")
    .select("fetched_at, status_code")
    .eq("source", provider.source)
    .eq("query_key", searchKey.key)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error) throw new DatabaseError("offer_search_runs.select", last.error);
  if (!options.force && isRunFresh(last.data, now)) {
    return { key: searchKey.key, skipped: true, offers: 0, invalidItems: 0 };
  }

  const run = {
    source: provider.source,
    query_key: searchKey.key,
    params: searchKey.params as Json,
    fetched_at: now.toISOString(),
  };
  let result;
  try {
    result = await provider.search(searchKey.params);
  } catch (error) {
    const status = error instanceof ExternalApiError ? (error.status ?? 0) : 0;
    await db.from("offer_search_runs").insert({ ...run, status_code: status, result_count: 0 });
    throw error;
  }

  const rows = uniqueByExternalId(result.offers.map((offer) => toOfferRow(offer, now)));
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await db
      .from("offers")
      .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "source,external_id" });
    if (error) throw new DatabaseError("offers.upsert", error);
  }
  const inserted = await db.from("offer_search_runs").insert({
    ...run,
    status_code: 200,
    result_count: rows.length,
    warnings: result.warnings as Json,
  });
  if (inserted.error) throw new DatabaseError("offer_search_runs.insert", inserted.error);

  log.info("search_synced", {
    offers: rows.length,
    duplicates: result.offers.length - rows.length,
    invalidItems: result.skipped,
  });
  return { key: searchKey.key, skipped: false, offers: rows.length, invalidItems: result.skipped };
}

/** Marks expired offers, and offers not seen for STALE_AFTER_MS, as removed. */
export async function markStaleOffers(db: Db, now: Date): Promise<number> {
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  const { data, error } = await db
    .from("offers")
    .update({ removed_at: nowIso })
    .is("removed_at", null)
    .or(`expires_at.lt."${nowIso}",last_seen_at.lt."${staleBefore}"`)
    .select("id");
  if (error) throw new DatabaseError("offers.mark_stale", error);
  return data.length;
}

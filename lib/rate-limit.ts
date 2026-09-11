import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

/** Per-user limits [requests, window in seconds] for the costly actions (docs/QUESTIONS.md C68). */
export const RATE_LIMITS = {
  refresh_offers: [6, 600],
  // Daily searches of the plans (docs/QUESTIONS.md C82); Premium has no daily cap.
  refresh_offers_basic: [3, 86_400],
  refresh_offers_plus: [10, 86_400],
  start_checkout: [10, 3600],
  suggest_rome: [20, 600],
  prepare_application: [30, 3600],
  upload_document: [20, 3600],
  export_data: [5, 3600],
  geocode: [60, 60],
} as const satisfies Record<string, readonly [number, number]>;

export type RateLimitedAction = keyof typeof RATE_LIMITS;

export const RATE_LIMITED_MESSAGE =
  "Trop de demandes en peu de temps. Réessayez dans quelques minutes.";

/**
 * True when the signed-in user may go on. Uses the user's own session, so the counter key
 * comes from auth.uid(). Fails open: a limiter outage must not block students.
 */
export async function allowAction(
  supabase: SupabaseClient<Database>,
  action: RateLimitedAction,
): Promise<boolean> {
  const [limit, windowSeconds] = RATE_LIMITS[action];
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    logger.warn("rate_limit_unavailable", { action, code: error.code });
    return true;
  }
  if (data === false) logger.warn("rate_limited", { action });
  return data !== false;
}

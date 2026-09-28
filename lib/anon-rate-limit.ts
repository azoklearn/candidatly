import "server-only";

import { createHmac } from "node:crypto";

import { getSupabaseAdminEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Limits for visitors, who have no session yet (docs/QUESTIONS.md C91). The counter key is
 * a keyed hash of the caller's address: the address itself is neither logged nor stored.
 */

export const ANON_RATE_LIMITS = {
  geocode: [40, 60],
  suggest_rome: [15, 600],
  save_location: [20, 3600],
} as const satisfies Record<string, readonly [number, number]>;

export type AnonRateLimitedAction = keyof typeof ANON_RATE_LIMITS;

/** The caller's address behind Vercel; "unknown" groups everyone we cannot tell apart. */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function clientHash(address: string): string {
  const secret = getSupabaseAdminEnv().SUPABASE_SECRET_KEY;
  return createHmac("sha256", secret).update(address).digest("hex").slice(0, 32);
}

/** Fails open, like the limiter of signed-in users: an outage must not block visitors. */
export async function allowAnonymousAction(
  action: AnonRateLimitedAction,
  headers: Headers,
): Promise<boolean> {
  const [limit, windowSeconds] = ANON_RATE_LIMITS[action];
  try {
    const { data, error } = await createAdminClient().rpc("check_anon_rate_limit", {
      p_client_hash: clientHash(clientAddress(headers)),
      p_action: action,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      logger.warn("anon_rate_limit_unavailable", { action, code: error.code });
      return true;
    }
    if (data === false) logger.warn("anon_rate_limited", { action });
    return data !== false;
  } catch (error) {
    logger.warn("anon_rate_limit_failed", { action, error });
    return true;
  }
}

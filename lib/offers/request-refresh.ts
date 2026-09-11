import { logger } from "@/lib/logger";
import { refreshOffersForUser } from "@/lib/offers/refresh";
import { createApiAlternanceProvider } from "@/lib/providers/api-alternance";
import { createAdminClient } from "@/lib/supabase/admin";

export type RefreshOutcome = "done" | "failed";

/**
 * Fetches a user's offers (cache permitting) and recomputes their matches right away,
 * after onboarding and from the "Actualiser" button. It takes a few seconds; the
 * scheduled sync (app/api/cron/sync-offers) keeps every search fresh in the background.
 */
export async function requestOffersRefresh(userId: string): Promise<RefreshOutcome> {
  const log = logger.child({ area: "offers", userId });
  try {
    const result = await refreshOffersForUser({
      db: createAdminClient(),
      provider: createApiAlternanceProvider({ logger: log }),
      userId,
      now: new Date(),
    });
    log.info("refresh_done", { offers: result.sync?.offers ?? 0, matched: result.matches.matched });
    return "done";
  } catch (error) {
    log.error("refresh_failed", { error });
    return "failed";
  }
}

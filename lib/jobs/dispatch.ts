import { tasks } from "@trigger.dev/sdk";

import { isTriggerConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { refreshOffersForUser } from "@/lib/offers/refresh";
import { createApiAlternanceProvider } from "@/lib/providers/api-alternance";
import { createAdminClient } from "@/lib/supabase/admin";
import type { refreshUserOffers } from "@/trigger/refresh-user-offers";

export type RefreshOutcome = "queued" | "done" | "failed";

/**
 * Fetches a user's offers and computes their matches: as a Trigger.dev job when
 * TRIGGER_SECRET_KEY is set, inline otherwise (local development without Trigger.dev).
 */
export async function requestOffersRefresh(userId: string): Promise<RefreshOutcome> {
  const log = logger.child({ area: "jobs", userId });
  try {
    if (isTriggerConfigured()) {
      await tasks.trigger<typeof refreshUserOffers>(
        "refresh-user-offers",
        { userId },
        { idempotencyKey: `refresh-user-offers:${userId}`, idempotencyKeyTTL: "2m" },
      );
      return "queued";
    }
    const result = await refreshOffersForUser({
      db: createAdminClient(),
      provider: createApiAlternanceProvider({ logger: log }),
      userId,
      now: new Date(),
    });
    log.info("refresh_done_inline", {
      offers: result.sync?.offers ?? 0,
      matched: result.matches.matched,
    });
    return "done";
  } catch (error) {
    log.error("refresh_failed", { error });
    return "failed";
  }
}

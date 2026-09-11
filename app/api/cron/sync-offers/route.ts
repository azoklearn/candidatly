import { NextResponse, type NextRequest } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getCronEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runScheduledSync } from "@/lib/offers/scheduled-sync";
import { createApiAlternanceProvider } from "@/lib/providers/api-alternance";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called every 15 minutes by Supabase Cron (migration 20260911120000_schedule_offer_sync,
 * docs/RUNBOOK.md) with "Authorization: Bearer <CRON_SECRET>".
 */
export const maxDuration = 60;

const log = logger.child({ area: "cron", route: "sync-offers" });

export async function POST(request: NextRequest) {
  let secret: string;
  try {
    secret = getCronEnv().CRON_SECRET;
  } catch {
    log.error("cron_not_configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    log.warn("cron_unauthorized");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runScheduledSync({
      db: createAdminClient(),
      provider: createApiAlternanceProvider({ logger: log }),
      now: new Date(),
      logger: log,
    });
    return NextResponse.json(summary);
  } catch (error) {
    log.error("cron_failed", { error });
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}

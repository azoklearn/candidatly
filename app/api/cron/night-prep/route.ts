import { NextResponse, type NextRequest } from "next/server";

import { runNightPrep } from "@/lib/applications/night-prep";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getCronEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called once a night by Supabase Cron (migration 20261119180000_night_prep,
 * docs/RUNBOOK.md) with "Authorization: Bearer <CRON_SECRET>": prepares the letters of the
 * students who asked for it (docs/QUESTIONS.md C123). Sends nothing.
 */
export const maxDuration = 60;

const log = logger.child({ area: "cron", route: "night-prep" });

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
    return NextResponse.json(await runNightPrep({ db: createAdminClient(), logger: log }));
  } catch (error) {
    log.error("cron_failed", { error });
    return NextResponse.json({ error: "night_prep_failed" }, { status: 500 });
  }
}

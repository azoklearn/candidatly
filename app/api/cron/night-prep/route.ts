import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { runNightPrep } from "@/lib/applications/night-prep";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getCronEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called once a night by Supabase Cron (migration 20261119180000_night_prep,
 * docs/RUNBOOK.md) with "Authorization: Bearer <CRON_SECRET>": prepares the letters of the
 * students who asked for it (docs/QUESTIONS.md C123). Sends nothing. A body `{"only": "<user
 * id>"}` narrows the run to one account: the end-to-end tests use it so that a test run
 * never prepares letters for real students.
 */
const ScopeSchema = z.object({ only: z.uuid().optional() });
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
  // The scheduler sends an empty object; anything unreadable is a full run, as before.
  const scope = ScopeSchema.safeParse(await request.json().catch(() => ({})));
  if (!scope.success) return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  try {
    return NextResponse.json(
      await runNightPrep({
        db: createAdminClient(),
        logger: log,
        onlyUserId: scope.data.only,
      }),
    );
  } catch (error) {
    log.error("cron_failed", { error });
    return NextResponse.json({ error: "night_prep_failed" }, { status: 500 });
  }
}

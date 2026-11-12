import { NextResponse, type NextRequest } from "next/server";

import { EVENTS } from "@/lib/analytics";
import { trackServerEvent } from "@/lib/analytics-server";
import { createMollieClient, mollieWebhookUrl } from "@/lib/billing/mollie";
import { handleMolliePayment } from "@/lib/billing/mollie-billing";
import { getMollieEnv } from "@/lib/env";
import { ExternalApiError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mollie webhook (docs/QUESTIONS.md C109, docs/RUNBOOK.md). Mollie posts the id of a
 * payment and nothing else; there is no signature to check, and none is needed: the state
 * is read back from Mollie with our own key, so a forged call can only make us re-read a
 * real payment. A failure answers 500 so that Mollie delivers it again.
 */

const log = logger.child({ area: "billing", route: "mollie-webhook" });

export async function POST(request: NextRequest) {
  try {
    getMollieEnv();
  } catch {
    log.error("mollie_not_configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const id = new URLSearchParams(await request.text()).get("id") ?? "";
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }
  try {
    const outcome = await handleMolliePayment({
      db: createAdminClient(),
      mollie: createMollieClient(),
      paymentId: id,
      webhookUrl: mollieWebhookUrl(),
      logger: log,
    });
    if (outcome.kind === "activated") {
      await trackServerEvent(
        EVENTS.subscriptionActivated,
        { forfait: outcome.plan, facturation: outcome.billing },
        request,
      );
    } else if (outcome.kind === "ended") {
      await trackServerEvent(EVENTS.subscriptionEnded, { forfait: outcome.plan }, request);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    // An id Mollie does not know is not ours to retry: answer 200, as Mollie advises, so
    // that the endpoint tells nothing about which ids exist.
    if (error instanceof ValidationError) return NextResponse.json({ ok: true });
    if (error instanceof ExternalApiError && error.status === 404) {
      return NextResponse.json({ ok: true });
    }
    log.error("mollie_webhook_failed", { error });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

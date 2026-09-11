import { NextResponse, type NextRequest } from "next/server";

import { EVENTS } from "@/lib/analytics";
import { trackServerEvent } from "@/lib/analytics-server";
import { syncWhopMembership } from "@/lib/billing/sync-membership";
import { createWhopClient } from "@/lib/billing/whop";
import { WhopEventSchema, verifyWhopSignature, type WhopEvent } from "@/lib/billing/whop-webhook";
import { getWhopEnv } from "@/lib/env";
import { DatabaseError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Whop webhook (docs/QUESTIONS.md C83, docs/RUNBOOK.md). Membership events update the
 * student's subscription; every event is recorded once, and a failure answers 500 so that
 * Whop delivers it again.
 */

const log = logger.child({ area: "billing", route: "whop-webhook" });

/** "new" or "retry" to process the event, "done" when it was already handled. */
async function recordEvent(db: Db, event: WhopEvent): Promise<"new" | "retry" | "done"> {
  const inserted = await db.from("billing_events").insert({
    provider: "whop",
    event_id: event.id,
    type: event.type,
    // Only what identifies the event: the membership itself is read from the API.
    payload: { type: event.type, data: { id: event.data.id } },
  });
  if (!inserted.error) return "new";
  if (inserted.error.code !== "23505")
    throw new DatabaseError("billing_events.insert", inserted.error);
  const existing = await db
    .from("billing_events")
    .select("processed_at")
    .eq("event_id", event.id)
    .maybeSingle();
  if (existing.error) throw new DatabaseError("billing_events.select", existing.error);
  return existing.data?.processed_at ? "done" : "retry";
}

export async function POST(request: NextRequest) {
  let secret: string;
  try {
    secret = getWhopEnv().WHOP_WEBHOOK_SECRET;
  } catch {
    log.error("whop_not_configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await request.text();
  const verified = verifyWhopSignature({
    body,
    secret,
    headers: {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
  });
  if (!verified) {
    log.warn("whop_webhook_rejected");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: WhopEvent;
  try {
    event = WhopEventSchema.parse(JSON.parse(body));
  } catch {
    log.warn("whop_webhook_malformed");
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    if ((await recordEvent(db, event)) === "done") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    if (event.type.startsWith("membership.")) {
      const subscription = await syncWhopMembership({
        db,
        whop: createWhopClient(),
        membershipId: event.data.id,
        logger: log,
      });
      if (subscription && event.type === "membership.activated") {
        await trackServerEvent(
          EVENTS.subscriptionActivated,
          { forfait: subscription.plan, facturation: subscription.billing },
          request,
        );
      } else if (subscription && event.type === "membership.deactivated") {
        await trackServerEvent(EVENTS.subscriptionEnded, { forfait: subscription.plan }, request);
      }
    }
    const done = await db
      .from("billing_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", event.id);
    if (done.error) throw new DatabaseError("billing_events.update", done.error);
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("whop_webhook_failed", { type: event.type, error });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

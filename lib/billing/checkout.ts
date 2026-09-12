import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";
import { ANNUAL_MONTHS_CHARGED, PLANS, type Billing, type PlanId } from "@/lib/pricing";

import type { WhopClient } from "./whop";

/** Price the page displays for a plan, in cents. */
export function expectedPriceCents(plan: PlanId, billing: Billing): number {
  const monthly = PLANS.find((candidate) => candidate.id === plan)?.monthlyCents ?? 0;
  return billing === "monthly" ? monthly : monthly * ANNUAL_MONTHS_CHARGED;
}

/**
 * Whop checkout for one of our plans (docs/QUESTIONS.md C83). The metadata ties the future
 * membership to the student; the webhook reads it back. Null when the checkout cannot start.
 */
export async function startWhopCheckout(options: {
  db: Db;
  whop: Pick<WhopClient, "createCheckout">;
  userId: string;
  plan: PlanId;
  billing: Billing;
  returnUrl: string;
  logger?: Logger;
}): Promise<string | null> {
  const log = (options.logger ?? defaultLogger).child({ area: "billing", plan: options.plan });
  const row = await options.db
    .from("billing_plans")
    .select("provider_plan_id, price_cents")
    .eq("provider", "whop")
    .eq("plan", options.plan)
    .eq("billing", options.billing)
    .maybeSingle();
  if (row.error || !row.data) {
    log.error("billing_plan_missing", { billing: options.billing, code: row.error?.code });
    return null;
  }
  // Never send a student to a checkout that charges something else than the displayed
  // price: the plans on Whop must be re-linked after a price change (docs/RUNBOOK.md).
  const expected = expectedPriceCents(options.plan, options.billing);
  if (row.data.price_cents !== expected) {
    log.error("billing_plan_price_mismatch", {
      billing: options.billing,
      expected,
      linked: row.data.price_cents,
    });
    return null;
  }
  try {
    const checkout = await options.whop.createCheckout({
      planId: row.data.provider_plan_id,
      metadata: { user_id: options.userId, plan: options.plan, billing: options.billing },
      redirectUrl: options.returnUrl,
    });
    log.info("checkout_created", { billing: options.billing });
    return checkout.url;
  } catch (error) {
    log.error("checkout_failed", { error });
    return null;
  }
}

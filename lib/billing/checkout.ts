import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";
import type { Billing, PlanId } from "@/lib/pricing";

import type { WhopClient } from "./whop";

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
    .select("provider_plan_id")
    .eq("provider", "whop")
    .eq("plan", options.plan)
    .eq("billing", options.billing)
    .maybeSingle();
  if (row.error || !row.data) {
    log.error("billing_plan_missing", { billing: options.billing, code: row.error?.code });
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

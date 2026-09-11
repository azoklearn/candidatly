import { DatabaseError } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";

import { toSubscriptionRow, type SubscriptionRow } from "./subscriptions";
import type { WhopClient } from "./whop";

/**
 * Stores the current state of one Whop membership and returns it, or null when it is not
 * tied to a student. The webhook only says which membership changed; the state is read from
 * the API, so late or reordered deliveries cannot roll a subscription back.
 */
export async function syncWhopMembership(options: {
  db: Db;
  whop: Pick<WhopClient, "getMembership">;
  membershipId: string;
  logger?: Logger;
}): Promise<SubscriptionRow | null> {
  const log = (options.logger ?? defaultLogger).child({ membershipId: options.membershipId });
  const membership = await options.whop.getMembership(options.membershipId);
  const plans = await options.db
    .from("billing_plans")
    .select("plan, billing, provider_plan_id")
    .eq("provider", "whop");
  if (plans.error) throw new DatabaseError("billing_plans.select", plans.error);

  const row = toSubscriptionRow(membership, plans.data);
  if (!row) {
    log.warn("membership_not_linked", { status: membership.status });
    return null;
  }
  const { error } = await options.db
    .from("subscriptions")
    .upsert(row, { onConflict: "provider_subscription_id" });
  if (error?.code === "23503") {
    log.warn("membership_user_missing");
    return null;
  }
  if (error) throw new DatabaseError("subscriptions.upsert", error);
  log.info("membership_synced", { status: row.status, plan: row.plan });
  return row;
}

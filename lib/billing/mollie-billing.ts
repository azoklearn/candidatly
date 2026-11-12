import { z } from "zod";

import { DatabaseError } from "@/lib/errors";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";
import { BILLINGS, PLAN_IDS, PLANS, type Billing, type PlanId } from "@/lib/pricing";

import { expectedPriceCents } from "./checkout";
import { toMollieAmount, type MollieClient, type MollieSubscription } from "./mollie";

/**
 * Subscriptions on Mollie (docs/QUESTIONS.md C109). Mollie has no hosted subscription
 * page: the student pays the first period in a normal checkout, which gives a mandate;
 * the webhook then creates the subscription that renews it, starting one period later.
 * Every later charge comes back through the same webhook.
 */

export const MOLLIE_INTERVAL: Record<Billing, string> = {
  monthly: "1 month",
  annual: "12 months",
};

const CheckoutMetadataSchema = z.object({
  user_id: z.uuid(),
  plan: z.enum(PLAN_IDS),
  billing: z.enum(BILLINGS),
});

/** Same day one period later, in UTC; the 31st of a short month falls on its last day. */
export function addPeriod(from: Date, billing: Billing): Date {
  const months = billing === "monthly" ? 1 : 12;
  const target = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1, 12, 0, 0),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return target;
}

export const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

/** "2026-12-12" becomes an ISO timestamp at noon UTC; anything else gives null. */
function dateOnlyToIso(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return `${value}T12:00:00.000Z`;
}

export function planLabel(plan: PlanId, billing: Billing): string {
  const name = PLANS.find((candidate) => candidate.id === plan)?.name ?? plan;
  return `JobGPT ${name} ${billing === "monthly" ? "mensuel" : "annuel"}`;
}

type SubscriptionWrite = {
  user_id: string;
  provider: "mollie";
  provider_subscription_id: string;
  provider_customer_id: string;
  plan: PlanId;
  billing: Billing;
  status: "active" | "past_due" | "canceled";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  manage_url: null;
};

async function upsertSubscription(db: Db, row: SubscriptionWrite, log: Logger): Promise<boolean> {
  const { error } = await db
    .from("subscriptions")
    .upsert(row, { onConflict: "provider_subscription_id" });
  if (error?.code === "23503") {
    // The account was deleted between the payment and its confirmation.
    log.warn("mollie_user_missing");
    return false;
  }
  if (error) throw new DatabaseError("subscriptions.upsert", error);
  return true;
}

/**
 * Mollie checkout for one of our plans: the first period, paid in person. Null when the
 * checkout cannot start.
 */
export async function startMollieCheckout(options: {
  db: Db;
  mollie: Pick<MollieClient, "createCustomer" | "createFirstPayment">;
  userId: string;
  plan: PlanId;
  billing: Billing;
  returnUrl: string;
  webhookUrl: string;
  logger?: Logger;
}): Promise<string | null> {
  const log = (options.logger ?? defaultLogger).child({ area: "billing", plan: options.plan });
  try {
    // One Mollie customer per student: a returning student keeps theirs.
    const known = await options.db
      .from("subscriptions")
      .select("provider_customer_id")
      .eq("user_id", options.userId)
      .eq("provider", "mollie")
      .not("provider_customer_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (known.error) throw new DatabaseError("subscriptions.select", known.error);
    const customerId =
      known.data?.provider_customer_id ??
      (await options.mollie.createCustomer({ user_id: options.userId })).id;
    const payment = await options.mollie.createFirstPayment({
      customerId,
      amountCents: expectedPriceCents(options.plan, options.billing),
      description: planLabel(options.plan, options.billing),
      redirectUrl: options.returnUrl,
      webhookUrl: options.webhookUrl,
      metadata: { user_id: options.userId, plan: options.plan, billing: options.billing },
    });
    if (!payment.checkoutUrl) {
      log.error("mollie_checkout_without_url");
      return null;
    }
    log.info("checkout_created", { billing: options.billing, provider: "mollie" });
    return payment.checkoutUrl;
  } catch (error) {
    log.error("checkout_failed", { error, provider: "mollie" });
    return null;
  }
}

export type MolliePaymentOutcome =
  | { kind: "activated" | "renewed" | "ended"; plan: PlanId; billing: Billing }
  | { kind: "ignored"; reason: string };

/**
 * What a Mollie webhook means. It only names a payment: its state is read from the API with
 * our own key, which is what makes the call trustworthy, and late or repeated deliveries
 * lead to the same result.
 */
export async function handleMolliePayment(options: {
  db: Db;
  mollie: Pick<
    MollieClient,
    "getPayment" | "createSubscription" | "listSubscriptions" | "getSubscription"
  >;
  paymentId: string;
  webhookUrl: string;
  now?: Date;
  logger?: Logger;
}): Promise<MolliePaymentOutcome> {
  const log = (options.logger ?? defaultLogger).child({ paymentId: options.paymentId });
  const now = options.now ?? new Date();
  const payment = await options.mollie.getPayment(options.paymentId);
  const customerId = payment.customerId;
  if (!customerId) return { kind: "ignored", reason: "no_customer" };

  // A charge made by a subscription: the renewal, or its failure.
  if (payment.subscriptionId) {
    const subscription = await options.mollie.getSubscription(customerId, payment.subscriptionId);
    const metadata = CheckoutMetadataSchema.safeParse(subscription.metadata ?? {});
    if (!metadata.success) return { kind: "ignored", reason: "subscription_not_linked" };
    const { user_id, plan, billing } = metadata.data;
    const stored = await options.db
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("provider_subscription_id", subscription.id)
      .maybeSingle();
    if (stored.error) throw new DatabaseError("subscriptions.select", stored.error);
    // Cancelled by the student: the paid period runs to its end, nothing to rewrite.
    if (stored.data?.status === "canceling") return { kind: "ignored", reason: "canceling" };

    const base = {
      user_id,
      provider: "mollie" as const,
      provider_subscription_id: subscription.id,
      provider_customer_id: customerId,
      plan,
      billing,
      cancel_at_period_end: false,
      manage_url: null,
    };
    if (subscription.status !== "active") {
      // Mollie gave up after its own retries, or the mandate was revoked.
      await upsertSubscription(
        options.db,
        {
          ...base,
          status: "canceled",
          current_period_end: stored.data?.current_period_end ?? null,
        },
        log,
      );
      log.info("mollie_subscription_ended", { status: subscription.status });
      return { kind: "ended", plan, billing };
    }
    if (payment.status === "paid") {
      await upsertSubscription(
        options.db,
        {
          ...base,
          status: "active",
          current_period_end: dateOnlyToIso(subscription.nextPaymentDate),
        },
        log,
      );
      log.info("mollie_subscription_renewed", { plan });
      return { kind: "renewed", plan, billing };
    }
    if (["failed", "expired", "canceled"].includes(payment.status)) {
      // Mollie retries by itself: access stays open meanwhile, like a late renewal.
      await upsertSubscription(
        options.db,
        {
          ...base,
          status: "past_due",
          current_period_end: stored.data?.current_period_end ?? null,
        },
        log,
      );
      log.warn("mollie_renewal_failed", { status: payment.status });
    }
    return { kind: "ignored", reason: `renewal_${payment.status}` };
  }

  // The first payment, made in person: it opens the plan and starts the renewals.
  if (payment.sequenceType !== "first") return { kind: "ignored", reason: "not_first" };
  if (payment.status !== "paid") return { kind: "ignored", reason: `first_${payment.status}` };
  const metadata = CheckoutMetadataSchema.safeParse(payment.metadata ?? {});
  if (!metadata.success) return { kind: "ignored", reason: "payment_not_linked" };
  const { user_id, plan, billing } = metadata.data;
  const amountCents = expectedPriceCents(plan, billing);
  if (payment.amount.value !== toMollieAmount(amountCents).value) {
    log.error("mollie_amount_mismatch", { plan, billing });
    return { kind: "ignored", reason: "amount_mismatch" };
  }

  // A webhook delivered twice must not start two subscriptions, hence two charges.
  const existing = (await options.mollie.listSubscriptions(customerId)).find(
    (candidate: MollieSubscription) => candidate.metadata?.first_payment_id === payment.id,
  );
  const startDate = toDateOnly(addPeriod(now, billing));
  const subscription =
    existing ??
    (await options.mollie.createSubscription({
      customerId,
      mandateId: payment.mandateId,
      amountCents,
      interval: MOLLIE_INTERVAL[billing],
      startDate,
      // Unique per customer, as Mollie requires.
      description: `${planLabel(plan, billing)} · ${payment.id}`,
      webhookUrl: options.webhookUrl,
      metadata: { user_id, plan, billing, first_payment_id: payment.id },
    }));
  const stored = await upsertSubscription(
    options.db,
    {
      user_id,
      provider: "mollie",
      provider_subscription_id: subscription.id,
      provider_customer_id: customerId,
      plan,
      billing,
      status: "active",
      current_period_end: dateOnlyToIso(subscription.nextPaymentDate ?? subscription.startDate),
      cancel_at_period_end: false,
      manage_url: null,
    },
    log,
  );
  if (!stored) return { kind: "ignored", reason: "user_missing" };
  log.info("mollie_subscription_started", { plan, billing, reused: existing !== undefined });
  return { kind: "activated", plan, billing };
}

/**
 * Stops the renewals of a student's Mollie subscriptions. The period already paid stays
 * open until its end; nothing is refunded. Returns how many were stopped.
 */
export async function cancelMollieSubscriptions(options: {
  db: Db;
  mollie: Pick<MollieClient, "cancelSubscription">;
  userId: string;
  logger?: Logger;
}): Promise<number> {
  const log = (options.logger ?? defaultLogger).child({ area: "billing" });
  const rows = await options.db
    .from("subscriptions")
    .select("provider_subscription_id, provider_customer_id")
    .eq("user_id", options.userId)
    .eq("provider", "mollie")
    .in("status", ["active", "past_due"]);
  if (rows.error) throw new DatabaseError("subscriptions.select", rows.error);
  let stopped = 0;
  for (const row of rows.data) {
    if (!row.provider_customer_id) continue;
    await options.mollie.cancelSubscription(row.provider_customer_id, row.provider_subscription_id);
    const updated = await options.db
      .from("subscriptions")
      .update({ status: "canceling", cancel_at_period_end: true })
      .eq("provider_subscription_id", row.provider_subscription_id);
    if (updated.error) throw new DatabaseError("subscriptions.update", updated.error);
    stopped++;
  }
  log.info("mollie_subscriptions_cancelled", { stopped });
  return stopped;
}

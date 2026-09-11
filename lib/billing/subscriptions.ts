import { z } from "zod";

import { BILLINGS, PLAN_IDS, type Billing, type PlanId } from "@/lib/pricing";

/** Whop membership statuses (docs.whop.com, Membership object). */
export const MEMBERSHIP_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "completed",
  "canceled",
  "expired",
  "unresolved",
  "drafted",
  "canceling",
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/**
 * Statuses that open the paid features: paid, in trial, retrying a failed renewal, or
 * cancelled but still inside the paid period.
 */
export const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "trialing",
  "active",
  "past_due",
  "canceling",
]);

export const WhopMembershipSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  plan: z.object({ id: z.string() }).nullable().optional(),
  user: z.object({ id: z.string() }).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  renewal_period_end: z.string().nullable().optional(),
  cancel_at_period_end: z.boolean().nullable().optional(),
  manage_url: z.string().nullable().optional(),
});
export type WhopMembership = z.infer<typeof WhopMembershipSchema>;

export type BillingPlanRow = { plan: string; billing: string; provider_plan_id: string };

export type SubscriptionRow = {
  user_id: string;
  provider: "whop";
  provider_subscription_id: string;
  provider_customer_id: string | null;
  plan: PlanId;
  billing: Billing | null;
  status: MembershipStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  manage_url: string | null;
};

/** Set by our checkout (lib/billing/checkout.ts); memberships bought elsewhere lack it. */
const CheckoutMetadataSchema = z.object({
  user_id: z.uuid(),
  plan: z.enum(PLAN_IDS).optional(),
  billing: z.enum(BILLINGS).optional(),
});

const isPlanId = (value: string | undefined): value is PlanId =>
  (PLAN_IDS as readonly string[]).includes(value ?? "");
const isBilling = (value: string | undefined): value is Billing =>
  (BILLINGS as readonly string[]).includes(value ?? "");

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Null when the membership cannot be tied to a student and a plan. */
export function toSubscriptionRow(
  membership: WhopMembership,
  plans: BillingPlanRow[],
): SubscriptionRow | null {
  const metadata = CheckoutMetadataSchema.safeParse(membership.metadata ?? {});
  if (!metadata.success) return null;
  const known = plans.find((row) => row.provider_plan_id === membership.plan?.id);
  const plan = known?.plan ?? metadata.data.plan;
  if (!isPlanId(plan)) return null;
  const billing = known?.billing ?? metadata.data.billing;
  const status = (MEMBERSHIP_STATUSES as readonly string[]).includes(membership.status)
    ? (membership.status as MembershipStatus)
    : "unresolved";
  return {
    user_id: metadata.data.user_id,
    provider: "whop",
    provider_subscription_id: membership.id,
    provider_customer_id: membership.user?.id ?? null,
    plan,
    billing: isBilling(billing) ? billing : null,
    status,
    current_period_end: toIsoDate(membership.renewal_period_end),
    cancel_at_period_end: membership.cancel_at_period_end ?? false,
    manage_url: membership.manage_url?.startsWith("https://") ? membership.manage_url : null,
  };
}

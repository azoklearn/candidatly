import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { isBillingConfigured } from "@/lib/env";
import { DatabaseError } from "@/lib/errors";
import { PLAN_IDS, type PlanId } from "@/lib/pricing";
import type { RateLimitedAction } from "@/lib/rate-limit";
import type { Database } from "@/lib/supabase/database.types";

import { ACTIVE_STATUSES } from "./subscriptions";

/**
 * What a student may use (docs/QUESTIONS.md C83). The paywall is on only once a payment
 * provider is configured; until then, and for exempt accounts, everything stays open.
 */

export type SubscriptionSummary = {
  plan: PlanId;
  billing: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  manage_url: string | null;
  /** "mollie" subscriptions are stopped from the account page; "whop" ones on Whop. */
  provider?: string;
};

export type Access = {
  paywall: boolean;
  exempt: boolean;
  /** The best active membership, if any. */
  subscription: SubscriptionSummary | null;
  allowed: boolean;
  /** Features in reach: the membership's plan, or everything when nothing is charged. */
  plan: PlanId | null;
};

const PLAN_RANK: Record<PlanId, number> = { basic: 1, plus: 2, premium: 3 };

type StoredSubscription = Omit<SubscriptionSummary, "plan"> & { plan: string };

export function resolveAccess(input: {
  paywall: boolean;
  exempt: boolean;
  subscriptions: StoredSubscription[];
  now?: Date;
}): Access {
  const now = (input.now ?? new Date()).getTime();
  // A plan stopped by the student stays open until the end of what was paid, then closes
  // by the calendar: Mollie sends nothing when that day comes (C109).
  const lapsed = (row: StoredSubscription) =>
    row.status === "canceling" &&
    row.current_period_end !== null &&
    new Date(row.current_period_end).getTime() < now;
  const active = input.subscriptions
    .filter(
      (row): row is SubscriptionSummary =>
        ACTIVE_STATUSES.has(row.status) &&
        !lapsed(row) &&
        (PLAN_IDS as readonly string[]).includes(row.plan),
    )
    .sort((a, b) => PLAN_RANK[b.plan] - PLAN_RANK[a.plan]);
  const subscription = active[0] ?? null;
  const open = !input.paywall || input.exempt;
  return {
    paywall: input.paywall,
    exempt: input.exempt,
    subscription,
    allowed: open || subscription !== null,
    plan: open ? "premium" : (subscription?.plan ?? null),
  };
}

/** The tailored letter comes with the Plus and Premium plans. */
export function canPrepareLetters(access: Access): boolean {
  return access.plan !== null && PLAN_RANK[access.plan] >= PLAN_RANK.plus;
}

/** Daily search quota of the plan (C82): 3 for Basic, 10 for Plus, none for Premium. */
export function dailySearchAction(access: Access): RateLimitedAction | null {
  if (access.plan === "basic") return "refresh_offers_basic";
  if (access.plan === "plus") return "refresh_offers_plus";
  return null;
}

export async function loadAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Access> {
  const [profile, subscriptions] = await Promise.all([
    supabase.from("profiles").select("billing_exempt").eq("user_id", userId).maybeSingle(),
    supabase
      .from("subscriptions")
      .select(
        "plan, billing, status, current_period_end, cancel_at_period_end, manage_url, provider",
      )
      .eq("user_id", userId),
  ]);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  if (subscriptions.error) throw new DatabaseError("subscriptions.select", subscriptions.error);
  return resolveAccess({
    paywall: isBillingConfigured(),
    exempt: profile.data?.billing_exempt ?? false,
    subscriptions: subscriptions.data,
  });
}

/** Sends students without an active plan to the plans page. */
export async function requirePaidAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Access> {
  const access = await loadAccess(supabase, userId);
  if (!access.allowed) redirect("/forfait");
  return access;
}

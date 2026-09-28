/**
 * The numbers shown on /admin (docs/QUESTIONS.md C90). Everything here is pure: the page
 * reads the rows with the service key, these functions turn them into figures.
 */

import { ACTIVE_STATUSES } from "@/lib/billing/subscriptions";
import { ANNUAL_MONTHS_CHARGED, PLANS, PLAN_IDS, type PlanId } from "@/lib/pricing";

export type ProfileRow = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  onboarding_completed: boolean;
  chosen_plan: string | null;
  chosen_billing: string | null;
  billing_exempt: boolean;
  location_label: string | null;
};

export type SubscriptionRow = {
  user_id: string;
  plan: string;
  billing: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type ApplicationRow = { user_id: string; status: string; sent_at: string | null };

export type PlanCountsByPlan = Record<PlanId, number>;

function emptyPlanCounts(): PlanCountsByPlan {
  return { basic: 0, plus: 0, premium: 0 };
}

function asPlanId(value: string | null | undefined): PlanId | null {
  return (PLAN_IDS as readonly string[]).includes(value ?? "") ? (value as PlanId) : null;
}

export function isActiveSubscription(row: { status: string }): boolean {
  return ACTIVE_STATUSES.has(row.status);
}

/** What a membership brings in each month: an annual one charges ten months up front. */
export function monthlyCentsOf(plan: PlanId, billing: string | null): number {
  const monthly = PLANS.find((candidate) => candidate.id === plan)?.monthlyCents ?? 0;
  if (billing === "annual") return Math.round((monthly * ANNUAL_MONTHS_CHARGED) / 12);
  return monthly;
}

export function monthlyRevenueCents(subscriptions: readonly SubscriptionRow[]): number {
  return subscriptions.filter(isActiveSubscription).reduce((total, row) => {
    const plan = asPlanId(row.plan);
    return plan ? total + monthlyCentsOf(plan, row.billing) : total;
  }, 0);
}

export function countByPlan(values: readonly (string | null)[]): PlanCountsByPlan {
  const counts = emptyPlanCounts();
  for (const value of values) {
    const plan = asPlanId(value);
    if (plan) counts[plan] += 1;
  }
  return counts;
}

export function countByStatus(rows: readonly { status: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

export function countSince(
  rows: readonly { created_at: string }[],
  days: number,
  now: Date = new Date(),
): number {
  const floor = now.getTime() - days * 86_400_000;
  return rows.filter((row) => {
    const time = new Date(row.created_at).getTime();
    return !Number.isNaN(time) && time >= floor;
  }).length;
}

export type AccountSummary = {
  userId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  onboarded: boolean;
  location: string | null;
  chosenPlan: string | null;
  chosenBilling: string | null;
  subscription: SubscriptionRow | null;
  exempt: boolean;
  applications: number;
  sent: number;
};

/** One line per account, newest first, with its membership and its activity. */
export function buildAccounts(input: {
  profiles: readonly ProfileRow[];
  subscriptions: readonly SubscriptionRow[];
  applications: readonly ApplicationRow[];
}): AccountSummary[] {
  const active = new Map<string, SubscriptionRow>();
  for (const row of input.subscriptions) {
    if (!isActiveSubscription(row)) continue;
    if (!active.has(row.user_id)) active.set(row.user_id, row);
  }
  const counts = new Map<string, { total: number; sent: number }>();
  for (const row of input.applications) {
    const current = counts.get(row.user_id) ?? { total: 0, sent: 0 };
    current.total += 1;
    if (row.sent_at) current.sent += 1;
    counts.set(row.user_id, current);
  }
  return [...input.profiles]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((profile) => {
      const activity = counts.get(profile.user_id) ?? { total: 0, sent: 0 };
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
      return {
        userId: profile.user_id,
        email: profile.email,
        name: name.length > 0 ? name : null,
        createdAt: profile.created_at,
        onboarded: profile.onboarding_completed,
        location: profile.location_label,
        chosenPlan: profile.chosen_plan,
        chosenBilling: profile.chosen_billing,
        subscription: active.get(profile.user_id) ?? null,
        exempt: profile.billing_exempt,
        applications: activity.total,
        sent: activity.sent,
      };
    });
}

export type Overview = {
  accounts: number;
  signups7d: number;
  onboarded: number;
  planChoices: PlanCountsByPlan;
  activeSubscriptions: number;
  subscriptionsByPlan: PlanCountsByPlan;
  monthlyRevenueCents: number;
  applications: number;
  applicationsSent: number;
  applicationsByStatus: Record<string, number>;
  liveOffers: number;
  matches: number;
  hiringCompanies: number;
};

export function buildOverview(input: {
  profiles: readonly ProfileRow[];
  subscriptions: readonly SubscriptionRow[];
  applications: readonly ApplicationRow[];
  liveOffers: number;
  matches: number;
  hiringCompanies: number;
  now?: Date;
}): Overview {
  const active = input.subscriptions.filter(isActiveSubscription);
  return {
    accounts: input.profiles.length,
    signups7d: countSince(input.profiles, 7, input.now ?? new Date()),
    onboarded: input.profiles.filter((profile) => profile.onboarding_completed).length,
    planChoices: countByPlan(input.profiles.map((profile) => profile.chosen_plan)),
    activeSubscriptions: active.length,
    subscriptionsByPlan: countByPlan(active.map((row) => row.plan)),
    monthlyRevenueCents: monthlyRevenueCents(input.subscriptions),
    applications: input.applications.length,
    applicationsSent: input.applications.filter((row) => row.sent_at !== null).length,
    applicationsByStatus: countByStatus(input.applications),
    liveOffers: input.liveOffers,
    matches: input.matches,
    hiringCompanies: input.hiringCompanies,
  };
}

/** Share as a whole percent, 0 when there is nothing to divide by. */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

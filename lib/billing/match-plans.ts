// Type-only imports: scripts/whop-setup.ts runs this file with plain Node (no path aliases).
import type { Billing, Plan, PlanId } from "@/lib/pricing";

/** A plan as listed by the Whop API (GET /plans). */
export type WhopPlanListing = {
  id: string;
  title?: string | null;
  plan_type?: string | null;
  billing_period?: number | null;
  currency?: string | null;
  initial_price?: number | null;
  renewal_price?: number | null;
  /** "hidden" once the owner retired the plan; Whop keeps it for its live memberships. */
  visibility?: string | null;
};

export type PlanLink = {
  plan: PlanId;
  billing: Billing;
  providerPlanId: string;
  priceCents: number;
};

/**
 * Days between two charges accepted for each billing, as set in the Whop dashboard. The
 * plan paid once is sold on Mollie only (C113): no Whop plan ever fits it.
 */
const PERIOD_DAYS: Record<Exclude<Billing, "lifetime">, readonly [number, number]> = {
  monthly: [28, 31],
  quarterly: [89, 92],
  annual: [360, 366],
};

const toCents = (euros: number | null | undefined) =>
  typeof euros === "number" ? Math.round(euros * 100) : null;

function fits(listing: WhopPlanListing, billing: Billing, cents: number): boolean {
  const currency = (listing.currency ?? "eur").toLowerCase();
  // A hidden plan cannot be sold again: Whop only keeps it alive for the memberships
  // already bought on it. Counting it would make a replacement plan look ambiguous.
  if ((listing.visibility ?? "visible") === "hidden" || currency !== "eur") return false;
  if (billing === "lifetime") return false;
  const [min, max] = PERIOD_DAYS[billing];
  const period = listing.billing_period ?? -1;
  return (
    (listing.plan_type ?? "renewal") === "renewal" &&
    period >= min &&
    period <= max &&
    toCents(listing.renewal_price ?? listing.initial_price) === cents
  );
}

/**
 * Pairs our renewing plans with the plans the owner created on Whop: same billing period and
 * same price in euros. Ids given explicitly win. A plan without exactly one match is
 * reported, never guessed.
 */
export function matchWhopPlans(input: {
  plans: readonly Plan[];
  listings: WhopPlanListing[];
  explicit?: Record<string, string>;
}): { links: PlanLink[]; missing: string[]; ambiguous: string[] } {
  const links: PlanLink[] = [];
  const missing: string[] = [];
  const ambiguous: string[] = [];
  for (const plan of input.plans) {
    const billing = plan.billing;
    const key = `${plan.id}:${billing}`;
    const priceCents = plan.priceCents;
    const forced = input.explicit?.[key];
    if (forced) {
      links.push({ plan: plan.id, billing, providerPlanId: forced, priceCents });
      continue;
    }
    const candidates = input.listings.filter((listing) => fits(listing, billing, priceCents));
    const [only] = candidates;
    if (candidates.length === 1 && only) {
      links.push({ plan: plan.id, billing, providerPlanId: only.id, priceCents });
    } else if (candidates.length === 0) {
      missing.push(key);
    } else {
      ambiguous.push(key);
    }
  }
  return { links, missing, ambiguous };
}

/** "--map=basic:monthly=plan_a,plus:annual=plan_b" to { "basic:monthly": "plan_a", ... }. */
export function parsePlanMap(value: string | undefined): Record<string, string> {
  if (!value) return {};
  return Object.fromEntries(
    value
      .split(",")
      .map((pair) => pair.trim().split("="))
      .filter(
        (parts): parts is [string, string] =>
          parts.length === 2 && /^plan_\w+$/.test(parts[1] ?? ""),
      )
      .map(([key, id]) => [key.trim(), id.trim()]),
  );
}

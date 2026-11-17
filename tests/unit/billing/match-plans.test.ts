import { describe, expect, it } from "vitest";

import { matchWhopPlans, parsePlanMap, type WhopPlanListing } from "@/lib/billing/match-plans";
import { PLANS } from "@/lib/pricing";

const listing = (
  id: string,
  price: number,
  period: number,
  extra: Partial<WhopPlanListing> = {},
) => ({
  id,
  title: id,
  plan_type: "renewal",
  billing_period: period,
  currency: "eur",
  initial_price: price,
  renewal_price: price,
  ...extra,
});

// The renewing plans of C113; the plan paid once is sold on Mollie only.
const RENEWING = PLANS.filter((plan) => plan.billing !== "lifetime");
const OWNER_PLANS = [listing("plan_1m", 19.9, 30), listing("plan_3m", 29.9, 90)];

const match = (listings: WhopPlanListing[], explicit?: Record<string, string>) =>
  matchWhopPlans({ plans: RENEWING, listings, explicit });

describe("matchWhopPlans", () => {
  it("ignores a retired plan that still carries its old memberships", () => {
    const result = match([
      ...OWNER_PLANS,
      listing("plan_3m_old", 29.9, 90, { visibility: "hidden" }),
    ]);
    expect(result.ambiguous).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.links.find((l) => l.plan === "plus")?.providerPlanId).toBe("plan_3m");
  });

  it("links 1 mois and 3 mois by period and price (C113)", () => {
    const result = match(OWNER_PLANS);
    expect(result.missing).toEqual([]);
    expect(result.links).toEqual([
      { plan: "basic", billing: "monthly", providerPlanId: "plan_1m", priceCents: 1990 },
      { plan: "plus", billing: "quarterly", providerPlanId: "plan_3m", priceCents: 2990 },
    ]);
  });

  it("never links the lifetime plan on Whop", () => {
    const result = matchWhopPlans({
      plans: PLANS,
      listings: [...OWNER_PLANS, listing("plan_life", 120, 0, { plan_type: "one_time" })],
    });
    expect(result.missing).toEqual(["premium:lifetime"]);
  });

  it("reports plans with another price, period or currency instead of guessing", () => {
    const result = match([
      listing("plan_1m", 19.9, 30),
      listing("plan_3m_wrong", 29.9, 30),
      listing("plan_usd", 29.9, 90, { currency: "usd" }),
    ]);
    expect(result.links.map((link) => link.providerPlanId)).toEqual(["plan_1m"]);
    expect(result.missing).toEqual(["plus:quarterly"]);
  });

  it("flags two plans at the same price and lets explicit ids decide", () => {
    const twins = [...OWNER_PLANS, listing("plan_1m_b", 19.9, 30)];
    expect(match(twins).ambiguous).toEqual(["basic:monthly"]);
    const forced = match(twins, { "basic:monthly": "plan_1m_b" });
    expect(forced.ambiguous).toEqual([]);
    expect(forced.links).toContainEqual(
      expect.objectContaining({ plan: "basic", billing: "monthly", providerPlanId: "plan_1m_b" }),
    );
  });
});

describe("parsePlanMap", () => {
  it("reads the --map option and drops malformed pairs", () => {
    expect(parsePlanMap("basic:monthly=plan_a1, plus:annual=plan_b2,oops,x=notaplan")).toEqual({
      "basic:monthly": "plan_a1",
      "plus:annual": "plan_b2",
    });
    expect(parsePlanMap(undefined)).toEqual({});
  });
});

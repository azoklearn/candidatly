import { describe, expect, it } from "vitest";

import { matchWhopPlans, parsePlanMap, type WhopPlanListing } from "@/lib/billing/match-plans";
import { ANNUAL_MONTHS_CHARGED, BILLINGS, PLANS } from "@/lib/pricing";

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

const OWNER_PLANS = [
  listing("plan_b_m", 14.99, 30),
  listing("plan_p_m", 24.99, 30),
  listing("plan_x_m", 39.99, 30),
  listing("plan_b_y", 149.9, 365),
  listing("plan_p_y", 249.9, 365),
  listing("plan_x_y", 399.9, 365),
];

const match = (listings: WhopPlanListing[], explicit?: Record<string, string>) =>
  matchWhopPlans({
    plans: PLANS,
    billings: BILLINGS,
    annualMonths: ANNUAL_MONTHS_CHARGED,
    listings,
    explicit,
  });

describe("matchWhopPlans", () => {
  it("links the owner's six plans by period and price", () => {
    const result = match(OWNER_PLANS);
    expect(result.missing).toEqual([]);
    expect(result.ambiguous).toEqual([]);
    expect(result.links).toContainEqual({
      plan: "plus",
      billing: "annual",
      providerPlanId: "plan_p_y",
      priceCents: 24990,
    });
    expect(result.links).toHaveLength(6);
  });

  it("reports plans with another price, period or currency instead of guessing", () => {
    const result = match([
      listing("plan_b_m", 14.99, 30),
      listing("plan_p_m", 19.99, 30),
      listing("plan_x_m", 39.99, 7),
      listing("plan_usd", 149.9, 365, { currency: "usd" }),
    ]);
    expect(result.links.map((link) => link.providerPlanId)).toEqual(["plan_b_m"]);
    expect(result.missing).toContain("plus:monthly");
    expect(result.missing).toContain("premium:monthly");
    expect(result.missing).toContain("basic:annual");
  });

  it("flags two plans at the same price and lets explicit ids decide", () => {
    const twins = [...OWNER_PLANS, listing("plan_b_m2", 14.99, 30)];
    expect(match(twins).ambiguous).toEqual(["basic:monthly"]);
    const forced = match(twins, { "basic:monthly": "plan_b_m2" });
    expect(forced.ambiguous).toEqual([]);
    expect(forced.links).toContainEqual(
      expect.objectContaining({ plan: "basic", billing: "monthly", providerPlanId: "plan_b_m2" }),
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

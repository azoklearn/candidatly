import { describe, expect, it } from "vitest";

import { canPrepareLetters, dailySearchAction, resolveAccess } from "@/lib/billing/access";
import { toSubscriptionRow, type WhopMembership } from "@/lib/billing/subscriptions";

const USER = "00000000-0000-4000-8000-00000000000a";
const PLANS = [
  { plan: "plus", billing: "annual", provider_plan_id: "plan_plus_year" },
  { plan: "basic", billing: "monthly", provider_plan_id: "plan_basic_month" },
];

const membership = (overrides: Partial<WhopMembership> = {}): WhopMembership => ({
  id: "mem_abc123",
  status: "active",
  plan: { id: "plan_plus_year" },
  user: { id: "user_42" },
  metadata: { user_id: USER, plan: "plus", billing: "annual" },
  renewal_period_end: "2027-09-11T17:00:00Z",
  cancel_at_period_end: false,
  manage_url: "https://whop.com/orders/mem_abc123",
  ...overrides,
});

describe("toSubscriptionRow", () => {
  it("ties the membership to the student and to our plan", () => {
    expect(toSubscriptionRow(membership(), PLANS)).toEqual({
      user_id: USER,
      provider: "whop",
      provider_subscription_id: "mem_abc123",
      provider_customer_id: "user_42",
      plan: "plus",
      billing: "annual",
      status: "active",
      current_period_end: "2027-09-11T17:00:00.000Z",
      cancel_at_period_end: false,
      manage_url: "https://whop.com/orders/mem_abc123",
    });
  });

  it("trusts our plan table over the metadata and keeps unknown statuses inactive", () => {
    const row = toSubscriptionRow(
      membership({ plan: { id: "plan_basic_month" }, status: "something_new" }),
      PLANS,
    );
    expect(row).toMatchObject({ plan: "basic", billing: "monthly", status: "unresolved" });
  });

  it("ignores memberships not bought through our checkout", () => {
    expect(toSubscriptionRow(membership({ metadata: null }), PLANS)).toBeNull();
    expect(
      toSubscriptionRow(membership({ metadata: { user_id: "not-a-uuid" } }), PLANS),
    ).toBeNull();
    expect(
      toSubscriptionRow(
        membership({ plan: { id: "plan_other" }, metadata: { user_id: USER } }),
        PLANS,
      ),
    ).toBeNull();
  });

  it("drops management links that are not https", () => {
    expect(
      toSubscriptionRow(membership({ manage_url: "javascript:alert(1)" }), PLANS)?.manage_url,
    ).toBeNull();
  });
});

const stored = (plan: string, status: string) => ({
  plan,
  status,
  billing: "monthly",
  current_period_end: null,
  cancel_at_period_end: false,
  manage_url: null,
});

describe("resolveAccess", () => {
  it("keeps everything open while payments are not configured", () => {
    const access = resolveAccess({ paywall: false, exempt: false, subscriptions: [] });
    expect(access).toMatchObject({ allowed: true, plan: "premium" });
    expect(dailySearchAction(access)).toBeNull();
  });

  it("closes the offers without an active membership", () => {
    const access = resolveAccess({
      paywall: true,
      exempt: false,
      subscriptions: [stored("premium", "expired"), stored("plus", "canceled")],
    });
    expect(access).toMatchObject({ allowed: false, plan: null, subscription: null });
    expect(canPrepareLetters(access)).toBe(false);
  });

  it("opens the features of the best active plan", () => {
    const basic = resolveAccess({
      paywall: true,
      exempt: false,
      subscriptions: [stored("basic", "active")],
    });
    expect(basic).toMatchObject({ allowed: true, plan: "basic" });
    expect(canPrepareLetters(basic)).toBe(false);
    expect(dailySearchAction(basic)).toBe("refresh_offers_basic");

    const both = resolveAccess({
      paywall: true,
      exempt: false,
      subscriptions: [stored("basic", "active"), stored("plus", "canceling")],
    });
    expect(both.plan).toBe("plus");
    expect(canPrepareLetters(both)).toBe(true);
    expect(dailySearchAction(both)).toBe("refresh_offers_plus");
  });

  it("gives exempt accounts everything", () => {
    const access = resolveAccess({ paywall: true, exempt: true, subscriptions: [] });
    expect(access).toMatchObject({ allowed: true, plan: "premium" });
  });
});

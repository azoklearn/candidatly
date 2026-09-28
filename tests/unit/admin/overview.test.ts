import { describe, expect, it } from "vitest";

import {
  buildAccounts,
  buildOverview,
  countSince,
  monthlyCentsOf,
  monthlyRevenueCents,
  percent,
  type ApplicationRow,
  type ProfileRow,
  type SubscriptionRow,
} from "@/lib/admin/overview";

const profile = (overrides: Partial<ProfileRow> & { user_id: string }): ProfileRow => ({
  email: `${overrides.user_id}@example.com`,
  first_name: "Camille",
  last_name: "Martin",
  created_at: "2026-09-20T10:00:00Z",
  onboarding_completed: true,
  chosen_plan: null,
  chosen_billing: null,
  billing_exempt: false,
  location_label: "Lyon",
  ...overrides,
});

const subscription = (
  overrides: Partial<SubscriptionRow> & { user_id: string },
): SubscriptionRow => ({
  plan: "basic",
  billing: "monthly",
  status: "active",
  current_period_end: null,
  cancel_at_period_end: false,
  ...overrides,
});

describe("admin overview", () => {
  it("counts an annual membership as ten months spread over twelve", () => {
    expect(monthlyCentsOf("basic", "monthly")).toBe(999);
    expect(monthlyCentsOf("basic", "annual")).toBe(833);
    expect(monthlyCentsOf("premium", "annual")).toBe(1666);
  });

  it("only counts the memberships that are really open", () => {
    const rows = [
      subscription({ user_id: "a" }),
      subscription({ user_id: "b", plan: "plus", status: "expired" }),
      subscription({ user_id: "c", plan: "premium", status: "canceling" }),
      subscription({ user_id: "d", plan: "unknown-plan" }),
    ];
    expect(monthlyRevenueCents(rows)).toBe(999 + 1999);
  });

  it("counts recent sign-ups from a given day", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    const rows = [
      { created_at: "2026-09-27T12:00:00Z" },
      { created_at: "2026-09-10T12:00:00Z" },
      { created_at: "not a date" },
    ];
    expect(countSince(rows, 7, now)).toBe(1);
  });

  it("puts each account with its membership and its activity, newest first", () => {
    const accounts = buildAccounts({
      profiles: [
        profile({ user_id: "old", created_at: "2026-09-01T10:00:00Z", chosen_plan: "plus" }),
        profile({
          user_id: "new",
          created_at: "2026-09-25T10:00:00Z",
          onboarding_completed: false,
          first_name: null,
          last_name: null,
        }),
      ],
      subscriptions: [
        subscription({ user_id: "old", plan: "expired-first", status: "expired" }),
        subscription({ user_id: "old", plan: "plus" }),
      ],
      applications: [
        { user_id: "old", status: "sent", sent_at: "2026-09-02T10:00:00Z" },
        { user_id: "old", status: "draft", sent_at: null },
      ] satisfies ApplicationRow[],
    });
    expect(accounts.map((account) => account.userId)).toEqual(["new", "old"]);
    expect(accounts[1]).toMatchObject({
      name: "Camille Martin",
      applications: 2,
      sent: 1,
      chosenPlan: "plus",
    });
    expect(accounts[1]?.subscription?.plan).toBe("plus");
    expect(accounts[0]).toMatchObject({ name: null, applications: 0, sent: 0, onboarded: false });
  });

  it("builds the figures of the dashboard", () => {
    const overview = buildOverview({
      profiles: [
        profile({ user_id: "a", chosen_plan: "basic" }),
        profile({ user_id: "b", chosen_plan: "basic", onboarding_completed: false }),
        profile({ user_id: "c", chosen_plan: "premium", created_at: "2026-01-01T10:00:00Z" }),
      ],
      subscriptions: [
        subscription({ user_id: "a" }),
        subscription({ user_id: "c", plan: "premium", status: "expired" }),
      ],
      applications: [
        { user_id: "a", status: "sent", sent_at: "2026-09-21T10:00:00Z" },
        { user_id: "a", status: "draft", sent_at: null },
      ],
      liveOffers: 59,
      matches: 120,
      hiringCompanies: 945,
      now: new Date("2026-09-22T10:00:00Z"),
    });
    expect(overview).toMatchObject({
      accounts: 3,
      signups7d: 2,
      onboarded: 2,
      activeSubscriptions: 1,
      monthlyRevenueCents: 999,
      applications: 2,
      applicationsSent: 1,
      liveOffers: 59,
    });
    expect(overview.planChoices).toEqual({ basic: 2, plus: 0, premium: 1 });
    expect(overview.subscriptionsByPlan).toEqual({ basic: 1, plus: 0, premium: 0 });
    expect(overview.applicationsByStatus).toEqual({ sent: 1, draft: 1 });
  });

  it("gives a share in whole percent, and nothing to divide by gives zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});

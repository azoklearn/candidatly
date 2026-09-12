import { describe, expect, it, vi } from "vitest";

import { expectedPriceCents, startWhopCheckout } from "@/lib/billing/checkout";
import { createLogger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";

const silent = createLogger({}, { write: () => {} });
const USER = "00000000-0000-4000-8000-00000000000a";

/** Minimal stand-in for the query chain used by startWhopCheckout. */
function fakeDb(row: { provider_plan_id: string; price_cents: number } | null): Db {
  const result = { data: row, error: null };
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  };
  return { from: () => chain } as unknown as Db;
}

const whop = (url = "https://whop.com/checkout/ch_1/") => ({
  createCheckout: vi.fn().mockResolvedValue({ id: "ch_1", url }),
});

describe("expectedPriceCents", () => {
  it("follows the displayed prices, ten months for a year", () => {
    expect(expectedPriceCents("basic", "monthly")).toBe(999);
    expect(expectedPriceCents("plus", "monthly")).toBe(1499);
    expect(expectedPriceCents("premium", "annual")).toBe(19990);
  });
});

describe("startWhopCheckout", () => {
  it("opens the checkout of the linked plan", async () => {
    const client = whop();
    const url = await startWhopCheckout({
      db: fakeDb({ provider_plan_id: "plan_plus_month", price_cents: 1499 }),
      whop: client,
      userId: USER,
      plan: "plus",
      billing: "monthly",
      returnUrl: "https://www.candidatly.app/forfait/merci",
      logger: silent,
    });
    expect(url).toBe("https://whop.com/checkout/ch_1/");
    expect(client.createCheckout).toHaveBeenCalledWith({
      planId: "plan_plus_month",
      metadata: { user_id: USER, plan: "plus", billing: "monthly" },
      redirectUrl: "https://www.candidatly.app/forfait/merci",
    });
  });

  it("refuses to charge a price the student was not shown", async () => {
    const client = whop();
    const url = await startWhopCheckout({
      db: fakeDb({ provider_plan_id: "plan_plus_month", price_cents: 2499 }),
      whop: client,
      userId: USER,
      plan: "plus",
      billing: "monthly",
      returnUrl: "https://www.candidatly.app/forfait/merci",
      logger: silent,
    });
    expect(url).toBeNull();
    expect(client.createCheckout).not.toHaveBeenCalled();
  });

  it("gives up when no plan is linked", async () => {
    const client = whop();
    await expect(
      startWhopCheckout({
        db: fakeDb(null),
        whop: client,
        userId: USER,
        plan: "basic",
        billing: "annual",
        returnUrl: "https://www.candidatly.app/forfait/merci",
        logger: silent,
      }),
    ).resolves.toBeNull();
    expect(client.createCheckout).not.toHaveBeenCalled();
  });
});

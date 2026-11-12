import { describe, expect, it, vi } from "vitest";

import { resolveAccess } from "@/lib/billing/access";
import { createMollieClient, toMollieAmount, type MolliePayment } from "@/lib/billing/mollie";
import {
  addPeriod,
  cancelMollieSubscriptions,
  handleMolliePayment,
  startMollieCheckout,
  toDateOnly,
} from "@/lib/billing/mollie-billing";
import { parseMollieEnv } from "@/lib/env";
import { ConfigError, ValidationError } from "@/lib/errors";
import type { FetchLike } from "@/lib/http/fetch-json";
import { createLogger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";

const silent = createLogger({}, { write: () => {} });
const USER = "00000000-0000-4000-8000-00000000000a";
const KEY = "test_0123456789abcdefghijABCDEFGHIJ";
const HOOK = "https://www.gptjob.io/api/mollie/webhook";
const NOW = new Date("2026-11-12T09:30:00.000Z");

/** Records what is written to `subscriptions`; reads answer with `stored`. */
function fakeDb(stored: Record<string, unknown> | Record<string, unknown>[] | null = null) {
  const writes: Array<{ kind: "upsert" | "update"; value: Record<string, unknown> }> = [];
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    in: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({
      data: Array.isArray(stored) ? (stored[0] ?? null) : stored,
      error: null,
    }),
    upsert: async (value: Record<string, unknown>) => {
      writes.push({ kind: "upsert", value });
      return { error: null };
    },
    update: (value: Record<string, unknown>) => {
      writes.push({ kind: "update", value });
      return { eq: async () => ({ error: null }) };
    },
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: Array.isArray(stored) ? stored : stored ? [stored] : [], error: null }),
  };
  return { db: { from: () => chain } as unknown as Db, writes };
}

const payment = (overrides: Partial<MolliePayment> = {}): MolliePayment => ({
  id: "tr_first1",
  status: "paid",
  amount: { currency: "EUR", value: "14.99" },
  sequenceType: "first",
  customerId: "cst_abc123",
  mandateId: "mdt_abc123",
  subscriptionId: null,
  metadata: { user_id: USER, plan: "plus", billing: "monthly" },
  ...overrides,
});

describe("Mollie configuration", () => {
  it("accepts test and live keys, and nothing that is not a Mollie key", () => {
    expect(parseMollieEnv({ MOLLIE_API_KEY: KEY }).MOLLIE_API_BASE_URL).toBe(
      "https://api.mollie.com/v2",
    );
    expect(() => parseMollieEnv({ MOLLIE_API_KEY: "apik_whatever_0123456789abcdef" })).toThrow(
      ConfigError,
    );
    expect(() => parseMollieEnv({})).toThrow(ConfigError);
  });
});

describe("Mollie client", () => {
  function setup(body: unknown) {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createMollieClient({
      apiKey: KEY,
      apiBaseUrl: "https://api.mollie.com/v2",
      fetchImpl,
    });
    return { client, calls };
  }

  it("writes amounts with two decimals", () => {
    expect(toMollieAmount(999)).toEqual({ currency: "EUR", value: "9.99" });
    expect(toMollieAmount(19990)).toEqual({ currency: "EUR", value: "199.90" });
  });

  it("creates a first payment tied to the customer and returns the checkout address", async () => {
    const { client, calls } = setup({
      id: "tr_first1",
      status: "open",
      amount: { currency: "EUR", value: "14.99" },
      _links: { checkout: { href: "https://www.mollie.com/checkout/select-method/abc" } },
    });
    const created = await client.createFirstPayment({
      customerId: "cst_abc123",
      amountCents: 1499,
      description: "JobGPT Plus mensuel",
      redirectUrl: "https://www.gptjob.io/forfait/merci",
      webhookUrl: HOOK,
      metadata: { user_id: USER, plan: "plus", billing: "monthly" },
    });
    expect(created.checkoutUrl).toBe("https://www.mollie.com/checkout/select-method/abc");
    const [call] = calls;
    expect(call?.url).toBe("https://api.mollie.com/v2/payments");
    expect(new Headers(call?.init?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(call?.init?.body))).toMatchObject({
      amount: { currency: "EUR", value: "14.99" },
      sequenceType: "first",
      customerId: "cst_abc123",
      webhookUrl: HOOK,
    });
  });

  it("refuses identifiers that are not Mollie's before calling the API", async () => {
    const { client, calls } = setup({});
    await expect(client.getPayment("../customers")).rejects.toBeInstanceOf(ValidationError);
    await expect(client.cancelSubscription("cst_ok1", "sub_../x")).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(calls).toHaveLength(0);
  });

  it("cancels a subscription with a DELETE", async () => {
    const { client, calls } = setup({ id: "sub_1", status: "canceled" });
    await client.cancelSubscription("cst_abc123", "sub_1");
    expect(calls[0]?.url).toBe(
      "https://api.mollie.com/v2/customers/cst_abc123/subscriptions/sub_1",
    );
    expect(calls[0]?.init?.method).toBe("DELETE");
  });
});

describe("addPeriod", () => {
  it("lands on the same day one period later", () => {
    expect(toDateOnly(addPeriod(NOW, "monthly"))).toBe("2026-12-12");
    expect(toDateOnly(addPeriod(NOW, "annual"))).toBe("2027-11-12");
  });

  it("falls on the last day of a shorter month", () => {
    expect(toDateOnly(addPeriod(new Date("2027-01-31T10:00:00Z"), "monthly"))).toBe("2027-02-28");
    expect(toDateOnly(addPeriod(new Date("2028-02-29T10:00:00Z"), "annual"))).toBe("2029-02-28");
  });
});

describe("startMollieCheckout", () => {
  it("creates a customer once, then the first payment at the displayed price", async () => {
    const mollie = {
      createCustomer: vi.fn().mockResolvedValue({ id: "cst_new1" }),
      createFirstPayment: vi
        .fn()
        .mockResolvedValue({ id: "tr_1", checkoutUrl: "https://www.mollie.com/checkout/x" }),
    };
    const url = await startMollieCheckout({
      db: fakeDb(null).db,
      mollie,
      userId: USER,
      plan: "premium",
      billing: "annual",
      returnUrl: "https://www.gptjob.io/forfait/merci",
      webhookUrl: HOOK,
      logger: silent,
    });
    expect(url).toBe("https://www.mollie.com/checkout/x");
    expect(mollie.createCustomer).toHaveBeenCalledWith({ user_id: USER });
    expect(mollie.createFirstPayment).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cst_new1", amountCents: 19990, webhookUrl: HOOK }),
    );
  });

  it("reuses the customer of a returning student, and gives null when Mollie fails", async () => {
    const mollie = {
      createCustomer: vi.fn(),
      createFirstPayment: vi.fn().mockRejectedValue(new Error("down")),
    };
    const url = await startMollieCheckout({
      db: fakeDb({ provider_customer_id: "cst_old1" }).db,
      mollie,
      userId: USER,
      plan: "basic",
      billing: "monthly",
      returnUrl: "https://www.gptjob.io/forfait/merci",
      webhookUrl: HOOK,
      logger: silent,
    });
    expect(url).toBeNull();
    expect(mollie.createCustomer).not.toHaveBeenCalled();
    expect(mollie.createFirstPayment).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cst_old1" }),
    );
  });
});

describe("handleMolliePayment", () => {
  const client = (paid: MolliePayment, existing: unknown[] = []) => ({
    getPayment: vi.fn().mockResolvedValue(paid),
    listSubscriptions: vi.fn().mockResolvedValue(existing),
    createSubscription: vi
      .fn()
      .mockResolvedValue({ id: "sub_new1", status: "active", nextPaymentDate: "2026-12-12" }),
    getSubscription: vi.fn(),
  });

  it("opens the plan after the first payment and starts the renewals one period later", async () => {
    const mollie = client(payment());
    const { db, writes } = fakeDb();
    const outcome = await handleMolliePayment({
      db,
      mollie,
      paymentId: "tr_first1",
      webhookUrl: HOOK,
      now: NOW,
      logger: silent,
    });
    expect(outcome).toEqual({ kind: "activated", plan: "plus", billing: "monthly" });
    expect(mollie.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cst_abc123",
        mandateId: "mdt_abc123",
        amountCents: 1499,
        interval: "1 month",
        startDate: "2026-12-12",
        metadata: {
          user_id: USER,
          plan: "plus",
          billing: "monthly",
          first_payment_id: "tr_first1",
        },
      }),
    );
    expect(writes[0]?.value).toMatchObject({
      user_id: USER,
      provider: "mollie",
      provider_subscription_id: "sub_new1",
      status: "active",
      current_period_end: "2026-12-12T12:00:00.000Z",
    });
  });

  it("never starts a second subscription when the webhook comes twice", async () => {
    const mollie = client(payment(), [
      {
        id: "sub_first",
        status: "active",
        nextPaymentDate: "2026-12-12",
        metadata: { first_payment_id: "tr_first1" },
      },
    ]);
    const outcome = await handleMolliePayment({
      db: fakeDb().db,
      mollie,
      paymentId: "tr_first1",
      webhookUrl: HOOK,
      now: NOW,
      logger: silent,
    });
    expect(outcome.kind).toBe("activated");
    expect(mollie.createSubscription).not.toHaveBeenCalled();
  });

  it("ignores a first payment that is unpaid, unlinked or of the wrong amount", async () => {
    for (const [paid, reason] of [
      [payment({ status: "open" }), "first_open"],
      [payment({ status: "failed" }), "first_failed"],
      [payment({ metadata: { plan: "plus" } }), "payment_not_linked"],
      [payment({ amount: { currency: "EUR", value: "0.01" } }), "amount_mismatch"],
      [payment({ customerId: null }), "no_customer"],
    ] as const) {
      const mollie = client(paid);
      const { db, writes } = fakeDb();
      const outcome = await handleMolliePayment({
        db,
        mollie,
        paymentId: "tr_first1",
        webhookUrl: HOOK,
        now: NOW,
        logger: silent,
      });
      expect(outcome).toEqual({ kind: "ignored", reason });
      expect(mollie.createSubscription).not.toHaveBeenCalled();
      expect(writes).toHaveLength(0);
    }
  });

  const renewal = (status: string, subscriptionStatus = "active") => ({
    ...client(
      payment({ id: "tr_renew1", status, sequenceType: "recurring", subscriptionId: "sub_new1" }),
    ),
    getSubscription: vi.fn().mockResolvedValue({
      id: "sub_new1",
      status: subscriptionStatus,
      nextPaymentDate: "2027-01-12",
      metadata: { user_id: USER, plan: "plus", billing: "monthly", first_payment_id: "tr_first1" },
    }),
  });
  const run = (mollie: ReturnType<typeof renewal>, stored: Record<string, unknown> | null) => {
    const { db, writes } = fakeDb(stored);
    return handleMolliePayment({
      db,
      mollie,
      paymentId: "tr_renew1",
      webhookUrl: HOOK,
      now: NOW,
      logger: silent,
    }).then((outcome) => ({ outcome, writes }));
  };
  const ACTIVE = { status: "active", current_period_end: "2026-12-12T12:00:00.000Z" };

  it("moves the period forward when a renewal is paid", async () => {
    const { outcome, writes } = await run(renewal("paid"), ACTIVE);
    expect(outcome.kind).toBe("renewed");
    expect(writes[0]?.value).toMatchObject({
      status: "active",
      current_period_end: "2027-01-12T12:00:00.000Z",
    });
  });

  it("keeps access open while Mollie retries a failed renewal", async () => {
    const { outcome, writes } = await run(renewal("failed"), ACTIVE);
    expect(outcome).toEqual({ kind: "ignored", reason: "renewal_failed" });
    expect(writes[0]?.value).toMatchObject({
      status: "past_due",
      current_period_end: ACTIVE.current_period_end,
    });
  });

  it("closes the plan when Mollie has ended the subscription", async () => {
    const { outcome, writes } = await run(renewal("failed", "canceled"), ACTIVE);
    expect(outcome.kind).toBe("ended");
    expect(writes[0]?.value).toMatchObject({ status: "canceled" });
  });

  it("leaves a plan stopped by the student as it is", async () => {
    const { outcome, writes } = await run(renewal("paid", "canceled"), {
      ...ACTIVE,
      status: "canceling",
    });
    expect(outcome).toEqual({ kind: "ignored", reason: "canceling" });
    expect(writes).toHaveLength(0);
  });
});

describe("cancelMollieSubscriptions", () => {
  it("stops the renewals and keeps the paid period", async () => {
    const mollie = { cancelSubscription: vi.fn().mockResolvedValue({}) };
    const { db, writes } = fakeDb([
      { provider_subscription_id: "sub_new1", provider_customer_id: "cst_abc123" },
    ]);
    expect(await cancelMollieSubscriptions({ db, mollie, userId: USER, logger: silent })).toBe(1);
    expect(mollie.cancelSubscription).toHaveBeenCalledWith("cst_abc123", "sub_new1");
    expect(writes[0]).toEqual({
      kind: "update",
      value: { status: "canceling", cancel_at_period_end: true },
    });
  });

  it("writes nothing when Mollie refuses", async () => {
    const mollie = { cancelSubscription: vi.fn().mockRejectedValue(new Error("down")) };
    const { db, writes } = fakeDb([
      { provider_subscription_id: "sub_new1", provider_customer_id: "cst_abc123" },
    ]);
    await expect(
      cancelMollieSubscriptions({ db, mollie, userId: USER, logger: silent }),
    ).rejects.toThrow("down");
    expect(writes).toHaveLength(0);
  });
});

describe("a plan stopped by the student", () => {
  const row = (current_period_end: string) => ({
    plan: "plus",
    billing: "monthly",
    status: "canceling",
    current_period_end,
    cancel_at_period_end: true,
    manage_url: null,
  });

  it("stays open until the end of the paid period, then closes by the calendar", () => {
    const open = resolveAccess({
      paywall: true,
      exempt: false,
      subscriptions: [row("2026-12-12T12:00:00.000Z")],
      now: NOW,
    });
    expect(open.allowed).toBe(true);
    const closed = resolveAccess({
      paywall: true,
      exempt: false,
      subscriptions: [row("2026-11-01T12:00:00.000Z")],
      now: NOW,
    });
    expect(closed.allowed).toBe(false);
    expect(closed.subscription).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { createWhopClient } from "@/lib/billing/whop";
import { ValidationError } from "@/lib/errors";
import type { FetchLike } from "@/lib/http/fetch-json";

const KEY = "apik_test_0123456789abcdefghij";

function setup(body: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createWhopClient({
    apiKey: KEY,
    apiBaseUrl: "https://api.whop.com/api/v1",
    checkoutBaseUrl: "https://whop.com",
    fetchImpl,
  });
  return { client, calls };
}

describe("Whop client", () => {
  it("creates a checkout for a plan and returns its full address", async () => {
    const { client, calls } = setup({ id: "ch_123", purchase_url: "/checkout/ch_123/" });
    const checkout = await client.createCheckout({
      planId: "plan_plus_year",
      metadata: { user_id: "u1", plan: "plus", billing: "annual" },
      redirectUrl: "https://www.candidatly.app/forfait/merci",
    });
    expect(checkout).toEqual({ id: "ch_123", url: "https://whop.com/checkout/ch_123/" });
    const [call] = calls;
    expect(call?.url).toBe("https://api.whop.com/api/v1/checkout_configurations");
    expect(call?.init?.method).toBe("POST");
    expect(new Headers(call?.init?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(call?.init?.body))).toEqual({
      mode: "payment",
      plan_id: "plan_plus_year",
      metadata: { user_id: "u1", plan: "plus", billing: "annual" },
      redirect_url: "https://www.candidatly.app/forfait/merci",
    });
  });

  it("reads a membership and refuses ids that are not memberships", async () => {
    const { client, calls } = setup({ id: "mem_abc123", status: "active", plan: { id: "plan_x" } });
    await expect(client.getMembership("mem_abc123")).resolves.toMatchObject({ status: "active" });
    expect(calls[0]?.url).toBe("https://api.whop.com/api/v1/memberships/mem_abc123");
    await expect(client.getMembership("../accounts/me")).rejects.toBeInstanceOf(ValidationError);
  });
});

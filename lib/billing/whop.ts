import { z } from "zod";

import { USER_AGENT } from "@/lib/brand";
import { getWhopEnv } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { fetchJson, type FetchLike } from "@/lib/http/fetch-json";

import { WhopMembershipSchema, type WhopMembership } from "./subscriptions";

/** Whop REST API v1 (https://api.whop.com/api/v1), with an Account API key. */

const TIMEOUT_MS = 10_000;
const MEMBERSHIP_ID_PATTERN = /^mem_[A-Za-z0-9]+$/;

const CheckoutConfigurationSchema = z.object({
  id: z.string().min(1),
  purchase_url: z.string().min(1),
});

export type WhopClientOptions = {
  apiKey: string;
  apiBaseUrl: string;
  checkoutBaseUrl: string;
  fetchImpl?: FetchLike;
};

function optionsFromEnv(): WhopClientOptions {
  const env = getWhopEnv();
  return {
    apiKey: env.WHOP_API_KEY,
    apiBaseUrl: env.WHOP_API_BASE_URL,
    checkoutBaseUrl: env.WHOP_CHECKOUT_BASE_URL,
  };
}

export function createWhopClient(options: WhopClientOptions = optionsFromEnv()) {
  const base = options.apiBaseUrl.replace(/\/+$/, "");
  const headers = { authorization: `Bearer ${options.apiKey}`, "user-agent": USER_AGENT };

  return {
    /** Checkout for an existing plan; its metadata is copied onto the membership. */
    async createCheckout(input: {
      planId: string;
      metadata: Record<string, string>;
      redirectUrl: string;
    }): Promise<{ id: string; url: string }> {
      const { data } = await fetchJson({
        source: "whop",
        url: new URL(`${base}/checkout_configurations`),
        method: "POST",
        headers,
        body: {
          mode: "payment",
          plan_id: input.planId,
          metadata: input.metadata,
          redirect_url: input.redirectUrl,
        },
        schema: CheckoutConfigurationSchema,
        timeoutMs: TIMEOUT_MS,
        fetchImpl: options.fetchImpl,
      });
      return { id: data.id, url: new URL(data.purchase_url, options.checkoutBaseUrl).toString() };
    },

    async getMembership(id: string): Promise<WhopMembership> {
      if (!MEMBERSHIP_ID_PATTERN.test(id)) {
        throw new ValidationError("Invalid Whop membership id", [
          { path: "id", message: "Expected mem_ followed by letters and digits" },
        ]);
      }
      const { data } = await fetchJson({
        source: "whop",
        url: new URL(`${base}/memberships/${id}`),
        headers,
        schema: WhopMembershipSchema,
        timeoutMs: TIMEOUT_MS,
        fetchImpl: options.fetchImpl,
      });
      return data;
    },
  };
}

export type WhopClient = ReturnType<typeof createWhopClient>;

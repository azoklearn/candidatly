import { z } from "zod";

import { USER_AGENT } from "@/lib/brand";
import { getMollieEnv, getPublicEnv } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { fetchJson, type FetchLike } from "@/lib/http/fetch-json";

/**
 * Mollie REST API v2 (https://api.mollie.com/v2), with the API key of the owner's profile.
 * Only what the subscriptions need: a customer, the first payment that gives the mandate,
 * the subscription itself, its reading and its cancellation (docs/QUESTIONS.md C109).
 */

const TIMEOUT_MS = 10_000;
const PAYMENT_ID = /^tr_[A-Za-z0-9]+$/;
const CUSTOMER_ID = /^cst_[A-Za-z0-9]+$/;
const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]+$/;

const AmountSchema = z.object({ currency: z.string(), value: z.string() });
const MetadataSchema = z.record(z.string(), z.unknown()).nullable().optional();

const CustomerSchema = z.object({ id: z.string().regex(CUSTOMER_ID) });

export const MolliePaymentSchema = z.object({
  id: z.string().regex(PAYMENT_ID),
  status: z.string(),
  amount: AmountSchema,
  sequenceType: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  mandateId: z.string().nullable().optional(),
  subscriptionId: z.string().nullable().optional(),
  metadata: MetadataSchema,
  _links: z
    .object({ checkout: z.object({ href: z.string() }).nullable().optional() })
    .nullable()
    .optional(),
});
export type MolliePayment = z.infer<typeof MolliePaymentSchema>;

export const MollieSubscriptionSchema = z.object({
  id: z.string().regex(SUBSCRIPTION_ID),
  status: z.string(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  nextPaymentDate: z.string().nullable().optional(),
  metadata: MetadataSchema,
});
export type MollieSubscription = z.infer<typeof MollieSubscriptionSchema>;

const SubscriptionListSchema = z.object({
  _embedded: z.object({ subscriptions: z.array(MollieSubscriptionSchema) }),
});

export type MollieClientOptions = { apiKey: string; apiBaseUrl: string; fetchImpl?: FetchLike };

function optionsFromEnv(): MollieClientOptions {
  const env = getMollieEnv();
  return { apiKey: env.MOLLIE_API_KEY, apiBaseUrl: env.MOLLIE_API_BASE_URL };
}

function check(pattern: RegExp, value: string, path: string): string {
  if (!pattern.test(value)) {
    throw new ValidationError(`Invalid Mollie ${path}`, [{ path, message: "Unexpected format" }]);
  }
  return value;
}

/**
 * Where Mollie reports every payment. Always the public address: Mollie refuses a webhook
 * it cannot reach, and a POST does not follow the redirect of the bare domain.
 */
export function mollieWebhookUrl(): string {
  return `${getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/api/mollie/webhook`;
}

/** 1499 becomes "14.99": Mollie wants a string with exactly two decimals. */
export function toMollieAmount(cents: number): { currency: "EUR"; value: string } {
  return { currency: "EUR", value: (cents / 100).toFixed(2) };
}

export function createMollieClient(options: MollieClientOptions = optionsFromEnv()) {
  const base = options.apiBaseUrl.replace(/\/+$/, "");
  const headers = { authorization: `Bearer ${options.apiKey}`, "user-agent": USER_AGENT };
  const common = { source: "mollie", headers, timeoutMs: TIMEOUT_MS, fetchImpl: options.fetchImpl };

  return {
    /** A customer carries the mandate and the subscription; it only holds our own id. */
    async createCustomer(metadata: Record<string, string>): Promise<{ id: string }> {
      const { data } = await fetchJson({
        ...common,
        url: new URL(`${base}/customers`),
        method: "POST",
        body: { metadata },
        schema: CustomerSchema,
      });
      return data;
    },

    /** The checkout the student pays in person: it creates the mandate for the renewals. */
    async createFirstPayment(input: {
      customerId: string;
      amountCents: number;
      description: string;
      redirectUrl: string;
      webhookUrl: string;
      metadata: Record<string, string>;
    }): Promise<{ id: string; checkoutUrl: string | null }> {
      const { data } = await fetchJson({
        ...common,
        url: new URL(`${base}/payments`),
        method: "POST",
        body: {
          amount: toMollieAmount(input.amountCents),
          description: input.description,
          redirectUrl: input.redirectUrl,
          webhookUrl: input.webhookUrl,
          customerId: check(CUSTOMER_ID, input.customerId, "customerId"),
          sequenceType: "first",
          locale: "fr_FR",
          metadata: input.metadata,
        },
        schema: MolliePaymentSchema,
      });
      return { id: data.id, checkoutUrl: data._links?.checkout?.href ?? null };
    },

    async getPayment(id: string): Promise<MolliePayment> {
      const { data } = await fetchJson({
        ...common,
        url: new URL(`${base}/payments/${check(PAYMENT_ID, id, "paymentId")}`),
        schema: MolliePaymentSchema,
      });
      return data;
    },

    async createSubscription(input: {
      customerId: string;
      mandateId?: string | null;
      amountCents: number;
      interval: string;
      startDate: string;
      description: string;
      webhookUrl: string;
      metadata: Record<string, string>;
    }): Promise<MollieSubscription> {
      const { data } = await fetchJson({
        ...common,
        url: new URL(
          `${base}/customers/${check(CUSTOMER_ID, input.customerId, "customerId")}/subscriptions`,
        ),
        method: "POST",
        body: {
          amount: toMollieAmount(input.amountCents),
          interval: input.interval,
          startDate: input.startDate,
          description: input.description,
          webhookUrl: input.webhookUrl,
          metadata: input.metadata,
          ...(input.mandateId ? { mandateId: input.mandateId } : {}),
        },
        schema: MollieSubscriptionSchema,
      });
      return data;
    },

    async listSubscriptions(customerId: string): Promise<MollieSubscription[]> {
      const { data } = await fetchJson({
        ...common,
        url: new URL(
          `${base}/customers/${check(CUSTOMER_ID, customerId, "customerId")}/subscriptions?limit=50`,
        ),
        schema: SubscriptionListSchema,
      });
      return data._embedded.subscriptions;
    },

    async getSubscription(customerId: string, id: string): Promise<MollieSubscription> {
      const { data } = await fetchJson({
        ...common,
        url: new URL(
          `${base}/customers/${check(CUSTOMER_ID, customerId, "customerId")}/subscriptions/${check(SUBSCRIPTION_ID, id, "subscriptionId")}`,
        ),
        schema: MollieSubscriptionSchema,
      });
      return data;
    },

    /** Stops the renewals. What is already paid stays paid: nothing is refunded here. */
    async cancelSubscription(customerId: string, id: string): Promise<MollieSubscription> {
      const { data } = await fetchJson({
        ...common,
        url: new URL(
          `${base}/customers/${check(CUSTOMER_ID, customerId, "customerId")}/subscriptions/${check(SUBSCRIPTION_ID, id, "subscriptionId")}`,
        ),
        method: "DELETE",
        schema: MollieSubscriptionSchema,
      });
      return data;
    },
  };
}

export type MollieClient = ReturnType<typeof createMollieClient>;

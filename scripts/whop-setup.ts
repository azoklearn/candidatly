/**
 * Sets up payments on Whop (docs/RUNBOOK.md, "Paiements Whop"): one product, the six plans
 * of lib/pricing.ts (three plans, monthly and yearly, in euros) and the webhook, then records
 * the plans in Supabase. Safe to run again: recorded plans and an existing webhook secret are
 * kept. Prints ids only, never a secret; the webhook secret is appended to .env.local.
 * Usage: npm run whop:setup [-- --site=https://www.candidatly.app]
 */
import { appendFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { ANNUAL_MONTHS_CHARGED, BILLINGS, PLANS, type Billing } from "../lib/pricing.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const API = (process.env.WHOP_API_BASE_URL || "https://api.whop.com/api/v1").replace(/\/+$/, "");
const SITE = (
  process.argv.find((arg) => arg.startsWith("--site="))?.slice("--site=".length) ||
  "https://www.candidatly.app"
).replace(/\/+$/, "");
const PERIOD_DAYS: Record<Billing, number> = { monthly: 30, annual: 365 };
const PERIOD_LABEL: Record<Billing, string> = { monthly: "mensuel", annual: "annuel" };
const WEBHOOK_EVENTS = [
  "membership.activated",
  "membership.deactivated",
  "membership.cancel_at_period_end_changed",
  "payment.succeeded",
  "payment.failed",
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is missing in .env.local`);
    process.exit(1);
  }
  return value;
}

const apiKey = required("WHOP_API_KEY");

async function whop<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Whop ${path}: HTTP ${response.status} ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}

async function main() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false } },
  );
  const account = await whop<{ id: string; title?: string }>("/accounts/me");
  console.log(`Whop account: ${account.id}${account.title ? ` (${account.title})` : ""}`);

  const existing = await db.from("billing_plans").select("plan, billing").eq("provider", "whop");
  if (existing.error) throw new Error(`billing_plans: ${existing.error.message}`);
  const recorded = new Set(existing.data.map((row) => `${row.plan}:${row.billing}`));
  const missing = PLANS.flatMap((plan) => BILLINGS.map((billing) => ({ plan, billing }))).filter(
    ({ plan, billing }) => !recorded.has(`${plan.id}:${billing}`),
  );

  if (missing.length > 0) {
    const product = await whop<{ id: string }>("/products", {
      account_id: account.id,
      title: "Candidatly",
      description:
        "Les offres d’alternance près de chez vous et une lettre adaptée à chaque entreprise.",
    });
    console.log(`Product: ${product.id}`);
    for (const { plan, billing } of missing) {
      const cents =
        billing === "monthly" ? plan.monthlyCents : plan.monthlyCents * ANNUAL_MONTHS_CHARGED;
      const price = cents / 100;
      const created = await whop<{ id: string }>("/plans", {
        company_id: account.id,
        product_id: product.id,
        title: `${plan.name} (${PERIOD_LABEL[billing]})`,
        plan_type: "renewal",
        billing_period: PERIOD_DAYS[billing],
        initial_price: price,
        renewal_price: price,
        currency: "eur",
      });
      const saved = await db.from("billing_plans").insert({
        provider: "whop",
        plan: plan.id,
        billing,
        provider_plan_id: created.id,
        price_cents: cents,
      });
      if (saved.error) throw new Error(`billing_plans insert: ${saved.error.message}`);
      console.log(`Plan ${plan.id} ${billing}: ${created.id} (${price.toFixed(2)} EUR)`);
    }
  } else {
    console.log("The six plans are already recorded.");
  }

  if (process.env.WHOP_WEBHOOK_SECRET) {
    console.log("WHOP_WEBHOOK_SECRET is already set: webhook left as it is.");
    return;
  }
  const webhook = await whop<{ id: string; webhook_secret?: string }>("/webhooks", {
    url: `${SITE}/api/whop/webhook`,
    api_version: "v1",
    enabled: true,
    events: WEBHOOK_EVENTS,
  });
  if (!webhook.webhook_secret) {
    throw new Error(
      `Webhook ${webhook.id} has no secret in the answer: copy it from the Whop dashboard (Developer > Webhooks).`,
    );
  }
  appendFileSync(".env.local", `\nWHOP_WEBHOOK_SECRET=${webhook.webhook_secret}\n`);
  console.log(`Webhook ${webhook.id} -> ${SITE}/api/whop/webhook; secret written to .env.local`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

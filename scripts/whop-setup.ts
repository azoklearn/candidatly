/**
 * Links the plans created on Whop to our six plans (docs/RUNBOOK.md, "Paiements Whop"): lists
 * the company's plans, pairs them with lib/pricing.ts by billing period and price in euros,
 * records the pairs in billing_plans, then creates the webhook. Safe to run again: pairs are
 * updated and an existing webhook secret is kept. Prints ids and prices only, never a secret;
 * the webhook secret is appended to .env.local.
 * Usage: npm run whop:setup -- [--dry-run] [--map=basic:monthly=plan_x,...] [--site=https://...]
 */
import { appendFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { matchWhopPlans, parsePlanMap, type WhopPlanListing } from "../lib/billing/match-plans.ts";
import { ANNUAL_MONTHS_CHARGED, BILLINGS, PLANS } from "../lib/pricing.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const DRY_RUN = process.argv.includes("--dry-run");
const API = (process.env.WHOP_API_BASE_URL || "https://api.whop.com/api/v1").replace(/\/+$/, "");
const SITE = (option("site") || "https://www.candidatly.app").replace(/\/+$/, "");
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

type PlanPage = {
  data: WhopPlanListing[];
  page_info?: { has_next_page?: boolean; end_cursor?: string | null };
};

async function listPlans(companyId: string): Promise<WhopPlanListing[]> {
  const plans: WhopPlanListing[] = [];
  let after: string | null = null;
  do {
    const query = new URLSearchParams({ company_id: companyId });
    if (after) query.set("after", after);
    const page: PlanPage = await whop<PlanPage>(`/plans?${query}`);
    plans.push(...page.data);
    after = page.page_info?.has_next_page ? (page.page_info.end_cursor ?? null) : null;
  } while (after);
  return plans;
}

const euros = (value: number | null | undefined) =>
  typeof value === "number" ? value.toFixed(2) : "?";

async function main() {
  const account = await whop<{ id: string; title?: string }>("/accounts/me");
  console.log(`Whop account: ${account.id}${account.title ? ` (${account.title})` : ""}`);

  const listings = await listPlans(account.id);
  console.log(`${listings.length} plan(s) on Whop:`);
  for (const plan of listings) {
    const first =
      plan.initial_price !== plan.renewal_price
        ? `, first payment ${euros(plan.initial_price)}`
        : "";
    console.log(
      `  ${plan.id}  ${plan.title ?? ""}  ${euros(plan.renewal_price ?? plan.initial_price)} ${(plan.currency ?? "?").toUpperCase()} every ${plan.billing_period ?? "?"} days (${plan.plan_type ?? "?"}${first})`,
    );
  }

  const result = matchWhopPlans({
    plans: PLANS,
    billings: BILLINGS,
    annualMonths: ANNUAL_MONTHS_CHARGED,
    listings,
    explicit: parsePlanMap(option("map")),
  });
  for (const link of result.links) {
    console.log(
      `Linked ${link.plan} ${link.billing} -> ${link.providerPlanId} (${euros(link.priceCents / 100)} EUR)`,
    );
  }
  if (result.missing.length > 0 || result.ambiguous.length > 0) {
    if (result.missing.length > 0)
      console.log(`No Whop plan at our price for: ${result.missing.join(", ")}`);
    if (result.ambiguous.length > 0)
      console.log(`Several Whop plans fit: ${result.ambiguous.join(", ")}`);
    console.log(
      "Nothing written. Align the price and period in Whop, or name the plans: --map=basic:monthly=plan_...",
    );
    process.exitCode = 1;
    return;
  }
  if (DRY_RUN) {
    console.log("Dry run: nothing written.");
    return;
  }

  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false } },
  );
  const saved = await db.from("billing_plans").upsert(
    result.links.map((link) => ({
      provider: "whop",
      plan: link.plan,
      billing: link.billing,
      provider_plan_id: link.providerPlanId,
      price_cents: link.priceCents,
    })),
    { onConflict: "provider,plan,billing" },
  );
  if (saved.error) throw new Error(`billing_plans: ${saved.error.message}`);
  console.log("The six plans are recorded in Supabase.");

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

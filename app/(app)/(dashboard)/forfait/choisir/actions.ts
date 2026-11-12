"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { EVENTS } from "@/lib/analytics";
import { trackServerEvent } from "@/lib/analytics-server";
import { authRedirectBase } from "@/lib/auth/routes";
import { requireUserId } from "@/lib/auth/session";
import { loadAccess } from "@/lib/billing/access";
import { startWhopCheckout } from "@/lib/billing/checkout";
import { createMollieClient, mollieWebhookUrl } from "@/lib/billing/mollie";
import { startMollieCheckout } from "@/lib/billing/mollie-billing";
import { createWhopClient } from "@/lib/billing/whop";
import { billingProvider, getPublicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { BILLINGS, PLAN_IDS } from "@/lib/pricing";
import { allowAction } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ChoiceSchema = z.object({ plan: z.enum(PLAN_IDS), billing: z.enum(BILLINGS) });
const UNAVAILABLE = "/forfait/choisir?paiement=indisponible";

/**
 * Plan chosen after the questionnaire (docs/QUESTIONS.md C82, C83): recorded, then paid on
 * Mollie or Whop. Until one of them is configured, access stays open and the student goes to the offers.
 */
export async function choosePlan(formData: FormData): Promise<void> {
  const parsed = ChoiceSchema.safeParse({
    plan: formData.get("plan"),
    billing: formData.get("billing"),
  });
  if (!parsed.success) redirect("/forfait/choisir");
  const { plan, billing } = parsed.data;
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      chosen_plan: plan,
      chosen_billing: billing,
      plan_chosen_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) logger.error("plan_choice_failed", { code: error.code });
  else logger.info("plan_chosen", { plan, billing });
  await trackServerEvent(EVENTS.planChosen, { forfait: plan, facturation: billing });

  const provider = billingProvider();
  if (!provider) redirect("/offers");
  const access = await loadAccess(supabase, userId);
  // A second checkout would bill twice: a plan is changed by stopping the current one first.
  if (access.subscription || access.exempt) redirect("/offers");
  if (!(await allowAction(supabase, "start_checkout"))) redirect(UNAVAILABLE);

  const origin = (await headers()).get("origin");
  const base = authRedirectBase(origin, getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const returnUrl = `${base}/forfait/merci`;
  // Mollie takes the new payments once its key is set (C109); Whop otherwise.
  const url =
    provider === "mollie"
      ? await startMollieCheckout({
          db: admin,
          mollie: createMollieClient(),
          userId,
          plan,
          billing,
          returnUrl,
          webhookUrl: mollieWebhookUrl(),
        })
      : await startWhopCheckout({
          db: admin,
          whop: createWhopClient(),
          userId,
          plan,
          billing,
          returnUrl,
        });
  if (url) await trackServerEvent(EVENTS.checkoutStarted, { forfait: plan, facturation: billing });
  redirect(url ?? UNAVAILABLE);
}

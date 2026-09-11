"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authRedirectBase } from "@/lib/auth/routes";
import { requireUserId } from "@/lib/auth/session";
import { loadAccess } from "@/lib/billing/access";
import { startWhopCheckout } from "@/lib/billing/checkout";
import { createWhopClient } from "@/lib/billing/whop";
import { getPublicEnv, isBillingConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { BILLINGS, PLAN_IDS } from "@/lib/pricing";
import { allowAction } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ChoiceSchema = z.object({ plan: z.enum(PLAN_IDS), billing: z.enum(BILLINGS) });
const UNAVAILABLE = "/forfait?paiement=indisponible";

/**
 * Plan chosen after the questionnaire (docs/QUESTIONS.md C82, C83): recorded, then paid on
 * Whop. Until Whop is configured, access stays open and the student goes to the offers.
 */
export async function choosePlan(formData: FormData): Promise<void> {
  const parsed = ChoiceSchema.safeParse({
    plan: formData.get("plan"),
    billing: formData.get("billing"),
  });
  if (!parsed.success) redirect("/forfait");
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

  if (!isBillingConfigured()) redirect("/offers");
  const access = await loadAccess(supabase, userId);
  // A second checkout would bill twice: plan changes go through Whop's own page.
  if (access.subscription || access.exempt) redirect("/offers");
  if (!(await allowAction(supabase, "start_checkout"))) redirect(UNAVAILABLE);

  const origin = (await headers()).get("origin");
  const base = authRedirectBase(origin, getPublicEnv().NEXT_PUBLIC_SITE_URL);
  const url = await startWhopCheckout({
    db: admin,
    whop: createWhopClient(),
    userId,
    plan,
    billing,
    returnUrl: `${base}/forfait/merci`,
  });
  redirect(url ?? UNAVAILABLE);
}

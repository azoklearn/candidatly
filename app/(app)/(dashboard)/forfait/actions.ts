"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserId } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { BILLINGS, PLAN_IDS } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ChoiceSchema = z.object({ plan: z.enum(PLAN_IDS), billing: z.enum(BILLINGS) });

/**
 * Records the plan chosen after the questionnaire (docs/QUESTIONS.md C82). No payment yet:
 * access stays open. The columns are written with the secret key, never by the client.
 */
export async function choosePlan(formData: FormData): Promise<void> {
  const parsed = ChoiceSchema.safeParse({
    plan: formData.get("plan"),
    billing: formData.get("billing"),
  });
  if (!parsed.success) redirect("/forfait");
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await createAdminClient()
    .from("profiles")
    .update({
      chosen_plan: parsed.data.plan,
      chosen_billing: parsed.data.billing,
      plan_chosen_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) logger.error("plan_choice_failed", { code: error.code });
  else logger.info("plan_chosen", { plan: parsed.data.plan, billing: parsed.data.billing });
  redirect("/offers");
}

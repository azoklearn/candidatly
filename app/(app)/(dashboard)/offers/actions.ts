"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { EVENTS } from "@/lib/analytics";
import { trackServerEvent } from "@/lib/analytics-server";
import { requireUserId } from "@/lib/auth/session";
import { dailySearchAction, requirePaidAccess } from "@/lib/billing/access";
import { requestOffersRefresh } from "@/lib/offers/request-refresh";
import { logger } from "@/lib/logger";
import { allowAction } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const StatusSchema = z.object({
  matchId: z.uuid(),
  status: z.enum(["new", "saved", "dismissed"]),
});

/** Save, unsave or dismiss an offer (brief section 5.2). RLS only allows the status column. */
export async function setMatchStatus(matchId: string, status: string): Promise<void> {
  const parsed = StatusSchema.safeParse({ matchId, status });
  if (!parsed.success) return;
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("matches")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.matchId)
    .eq("user_id", userId);
  if (error) logger.error("match_status_failed", { code: error.code });
  revalidatePath("/offers");
}

/**
 * One decision of the swipe view: keep or set aside. Same rule as the list, without
 * re-rendering the page under the card that is flying away (docs/QUESTIONS.md C120).
 */
export async function swipeMatch(matchId: string, status: string): Promise<{ ok: boolean }> {
  const parsed = StatusSchema.safeParse({ matchId, status });
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("matches")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.matchId)
    .eq("user_id", userId);
  if (error) logger.error("match_swipe_failed", { code: error.code });
  return { ok: !error };
}

/** Shows or hides the offers of schools, training bodies and agencies (C120). */
export async function setNoiseHidden(hidden: boolean): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("profiles")
    .update({ hide_noise: hidden === true })
    .eq("user_id", userId);
  if (error) logger.error("noise_setting_failed", { code: error.code });
  revalidatePath("/offers");
}

export async function refreshMyOffers(): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const access = await requirePaidAccess(supabase, userId);
  if (!(await allowAction(supabase, "refresh_offers"))) return;
  const daily = dailySearchAction(access);
  if (daily && !(await allowAction(supabase, daily))) return;
  await requestOffersRefresh(userId);
  await trackServerEvent(EVENTS.offersRefreshed);
  revalidatePath("/offers");
}

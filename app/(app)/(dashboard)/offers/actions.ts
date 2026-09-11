"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/lib/auth/session";
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

export async function refreshMyOffers(): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!(await allowAction(supabase, "refresh_offers"))) return;
  await requestOffersRefresh(userId);
  revalidatePath("/offers");
}

import { NextResponse, type NextRequest } from "next/server";

import { EVENTS } from "@/lib/analytics";
import { trackServerEvent } from "@/lib/analytics-server";
import { currentUserId } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { requestOffersRefresh } from "@/lib/offers/request-refresh";
import { nextOnboardingPath, isQuestionnaireDone } from "@/lib/onboarding/state";
import { createClient } from "@/lib/supabase/server";

import { loadOnboarding } from "../data";

const log = logger.child({ area: "onboarding" });

/**
 * End of the questionnaire, right after the account (docs/QUESTIONS.md C111): grants the
 * bonus, marks the questionnaire done, runs the student's first search and opens the
 * result. The CV is no longer asked here: it is dropped on the landing page.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return to("/onboarding/1");

  const { profile, snapshot } = await loadOnboarding(supabase, userId);
  if (profile.onboarding_completed) return to("/forfait");
  if (!isQuestionnaireDone(snapshot)) return to(nextOnboardingPath(snapshot));

  const bonus = await supabase.rpc("grant_signup_bonus");
  if (bonus.error) log.error("signup_bonus_failed", { code: bonus.error.code });
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("user_id", userId);
  if (error) {
    log.error("onboarding_completion_failed", { code: error.code });
    return to("/onboarding/6");
  }
  // The search of the questionnaire already warmed the cache: this mostly scores offers.
  const refresh = await requestOffersRefresh(userId);
  log.info("onboarding_completed", { refresh });
  await trackServerEvent(EVENTS.onboardingDone, undefined, request);
  return to("/forfait");
}

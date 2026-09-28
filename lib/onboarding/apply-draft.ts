import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

import { draftProfileUpdate, draftSnapshot, isDraftEmpty } from "./draft";
import { clearDraft, readDraft } from "./draft-cookie";
import { firstIncompleteStep } from "./state";

/**
 * Copies the answers given before the account existed onto the fresh profile and drops the
 * cookie (docs/QUESTIONS.md C91). Returns where to send the student next, or null when
 * there was nothing to apply. A finished questionnaire is never overwritten.
 */
export async function applyDraftAfterAuth(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const draft = await readDraft();
  if (isDraftEmpty(draft)) return null;
  const profile = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.data?.onboarding_completed !== false) {
    await clearDraft();
    return null;
  }
  const { error } = await supabase
    .from("profiles")
    .update(draftProfileUpdate(draft))
    .eq("user_id", userId);
  if (error) {
    logger.child({ area: "onboarding" }).error("draft_apply_failed", { code: error.code });
    return null;
  }
  await clearDraft();
  return `/onboarding/${firstIncompleteStep(draftSnapshot(draft))}`;
}

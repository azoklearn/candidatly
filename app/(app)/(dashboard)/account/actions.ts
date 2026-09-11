"use server";

import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountState = { error?: string };

const log = logger.child({ area: "account" });
const FAILED = "La suppression a échoué. Réessayez dans un instant.";

/**
 * Real deletion (brief section 5.7): stored files first, since rows are removed with the
 * user by "on delete cascade" but files are not; then the auth user; then the session.
 */
export async function deleteAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  if (String(formData.get("confirm") ?? "").trim() !== "SUPPRIMER") {
    return { error: "Tapez SUPPRIMER, en majuscules, pour confirmer." };
  }
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const admin = createAdminClient();
  const paths: string[] = [];
  for (const folder of ["cv", "letter"]) {
    const { data, error } = await admin.storage
      .from("documents")
      .list(`${userId}/${folder}`, { limit: 1000 });
    if (error) {
      log.error("account_files_list_failed", { code: error.name });
      return { error: FAILED };
    }
    paths.push(...data.map((file) => `${userId}/${folder}/${file.name}`));
  }
  if (paths.length > 0) {
    const removed = await admin.storage.from("documents").remove(paths);
    if (removed.error) {
      log.error("account_files_remove_failed", { code: removed.error.name });
      return { error: FAILED };
    }
  }
  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error) {
    log.error("account_delete_failed", { code: deleted.error.code });
    return { error: FAILED };
  }
  await supabase.auth.signOut();
  log.info("account_deleted", { files: paths.length });
  redirect("/?compte=supprime");
}

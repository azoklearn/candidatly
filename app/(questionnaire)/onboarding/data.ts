import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "@/lib/errors";
import type { OnboardingSnapshot } from "@/lib/onboarding/state";
import type { Database } from "@/lib/supabase/database.types";

export type DocumentSummary = {
  kind: "cv" | "cover_letter_base";
  filename: string | null;
  preview: string;
  pasted: boolean;
};

export async function loadOnboarding(supabase: SupabaseClient<Database>, userId: string) {
  const [profile, documents] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "first_name, last_name, phone, school, degree_label, diploma_level, target_contract, availability_date, domain_free_text, rome_codes, location_label, location_lat, location_lng, insee_code, search_radius_km, onboarding_completed, documents_skipped_at",
      )
      .eq("user_id", userId)
      .single(),
    supabase
      .from("documents")
      .select("kind, original_filename, extracted_text, storage_path")
      .eq("user_id", userId)
      .eq("is_current", true),
  ]);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  if (documents.error) throw new DatabaseError("documents.select", documents.error);

  const summary = (kind: DocumentSummary["kind"]): DocumentSummary | null => {
    const document = documents.data.find((d) => d.kind === kind);
    if (!document) return null;
    return {
      kind,
      filename: document.original_filename,
      preview: (document.extracted_text ?? "").slice(0, 600),
      pasted: document.storage_path === null,
    };
  };
  const cv = summary("cv");
  const letter = summary("cover_letter_base");
  const snapshot: OnboardingSnapshot = {
    profile: profile.data,
    hasCv: cv !== null,
    hasLetter: letter !== null,
  };
  return { profile: profile.data, cv, letter, snapshot };
}

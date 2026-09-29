import { z } from "zod";

import type { OnboardingProfile, OnboardingSnapshot } from "@/lib/onboarding/state";
import type { TablesUpdate } from "@/lib/supabase/database.types";

/**
 * Answers given before the account exists (docs/QUESTIONS.md C91). The questionnaire is
 * open to visitors: their answers travel in one cookie until they create their account,
 * and are copied into the profile at that moment. Nothing here identifies a person more
 * than what they typed, and the cookie is dropped as soon as it is applied.
 */

export const DRAFT_COOKIE = "candidatly_questionnaire";
export const DRAFT_MAX_AGE_SECONDS = 7 * 24 * 3600;

export const DraftSchema = z
  .object({
    first_name: z.string().max(80),
    last_name: z.string().max(80),
    phone: z.string().max(30).nullable(),
    school: z.string().max(120),
    degree_label: z.string().max(120),
    diploma_level: z.enum(["bac", "bac+2", "bac+3", "bac+4", "bac+5"]),
    target_contract: z.enum(["alternance", "stage", "both"]),
    contract_chosen_at: z.string().max(40),
    availability_date: z.string().max(10).nullable(),
    domain_free_text: z.string().max(500),
    rome_codes: z.array(z.string().regex(/^[A-Z]\d{4}$/)).max(5),
    rome_version: z.number().int(),
    location_label: z.string().max(200),
    location_lat: z.number(),
    location_lng: z.number(),
    insee_code: z.string().max(5).nullable(),
    search_radius_km: z.number().int(),
    // What the analysis found, shown on the account screen (docs/QUESTIONS.md C94).
    found_offers: z.number().int().min(0),
    found_companies: z.number().int().min(0),
  })
  .partial();

export type OnboardingDraft = z.infer<typeof DraftSchema>;

/** Never throws: a cookie that was tampered with or left over from an older shape reads as empty. */
export function parseDraft(raw: string | null | undefined): OnboardingDraft {
  if (!raw) return {};
  try {
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function serializeDraft(draft: OnboardingDraft): string {
  return JSON.stringify(draft);
}

export function mergeDraft(current: OnboardingDraft, patch: OnboardingDraft): OnboardingDraft {
  return { ...current, ...patch };
}

export function isDraftEmpty(draft: OnboardingDraft): boolean {
  return Object.keys(draft).length === 0;
}

/** The same progress rules as a signed-in student, read from the draft. */
export function draftSnapshot(draft: OnboardingDraft): OnboardingSnapshot {
  const profile: OnboardingProfile = {
    first_name: draft.first_name ?? null,
    last_name: draft.last_name ?? null,
    contract_chosen_at: draft.contract_chosen_at ?? null,
    domain_free_text: draft.domain_free_text ?? null,
    rome_codes: draft.rome_codes ?? [],
    diploma_level: draft.diploma_level ?? null,
    location_lat: draft.location_lat ?? null,
    location_lng: draft.location_lng ?? null,
    onboarding_completed: false,
    documents_skipped_at: null,
  };
  return { profile, hasCv: false, hasLetter: false };
}

/** The draft keys that are profile columns; the others (the counts) stay in the cookie. */
const PROFILE_FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "school",
  "degree_label",
  "diploma_level",
  "target_contract",
  "contract_chosen_at",
  "availability_date",
  "domain_free_text",
  "rome_codes",
  "rome_version",
  "location_label",
  "location_lat",
  "location_lng",
  "insee_code",
  "search_radius_km",
] as const satisfies readonly (keyof OnboardingDraft)[];

/** What to write on the profile once the account exists: only the answers that were given. */
export function draftProfileUpdate(draft: OnboardingDraft): TablesUpdate<"profiles"> {
  const update: TablesUpdate<"profiles"> = {};
  for (const key of PROFILE_FIELDS) {
    const value = draft[key];
    if (value !== undefined) Object.assign(update, { [key]: value });
  }
  return update;
}

/** The values of the profile screens, read from the draft. */
export function draftProfileValues(draft: OnboardingDraft) {
  return {
    first_name: draft.first_name ?? null,
    last_name: draft.last_name ?? null,
    phone: draft.phone ?? null,
    school: draft.school ?? null,
    degree_label: draft.degree_label ?? null,
    diploma_level: draft.diploma_level ?? null,
    target_contract: draft.target_contract ?? "alternance",
    availability_date: draft.availability_date ?? null,
  };
}

/** The answers the analysis needs, read from the draft (docs/QUESTIONS.md C94). */
export function draftProfileValuesForAnalysis(draft: OnboardingDraft) {
  return {
    rome_codes: draft.rome_codes ?? [],
    location_lat: draft.location_lat ?? null,
    location_lng: draft.location_lng ?? null,
    search_radius_km: draft.search_radius_km ?? 30,
    diploma_level: draft.diploma_level ?? null,
  };
}

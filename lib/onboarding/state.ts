import type { Tables } from "@/lib/supabase/database.types";

/**
 * The questionnaire (docs/QUESTIONS.md C92 and C93): five questions answered with the
 * thumb, then the account, the CV and the letter, and the analysis screen. Visitors go
 * through the first five without an account; the answers wait in a cookie (C91). The
 * questionnaire says "tu", like the landing page visitors arrive from.
 */

export const ONBOARDING_STEPS = [
  { step: 1, title: "Tu cherches quoi ?" },
  { step: 2, title: "C’est quoi ton domaine ?" },
  { step: 3, title: "Quels métiers ?" },
  { step: 4, title: "T’en es où dans tes études ?" },
  { step: 5, title: "Tu veux bosser où ?" },
  { step: 6, title: "Ton compte" },
  { step: 7, title: "Ton CV et ta lettre" },
  { step: 8, title: "Analyse en cours" },
] as const;

export const LAST_STEP = ONBOARDING_STEPS.length;
/** Everything a visitor can answer before the account exists. */
export const VISITOR_LAST_STEP = 5;
export const ACCOUNT_STEP = 6;
export const DOCUMENTS_STEP = 7;
export const ACCOUNT_STEP_PATH = "/onboarding/compte";

export type OnboardingProfile = Pick<
  Tables<"profiles">,
  | "first_name"
  | "last_name"
  | "contract_chosen_at"
  | "domain_free_text"
  | "rome_codes"
  | "diploma_level"
  | "location_lat"
  | "location_lng"
  | "onboarding_completed"
  | "documents_skipped_at"
>;

export type OnboardingSnapshot = { profile: OnboardingProfile; hasCv: boolean; hasLetter: boolean };

const filled = (value: string | null) => (value ?? "").trim().length > 0;

export function completedSteps({ profile, hasCv, hasLetter }: OnboardingSnapshot): Set<number> {
  const done = new Set<number>();
  if (profile.contract_chosen_at !== null) done.add(1);
  if (filled(profile.domain_free_text)) done.add(2);
  if (profile.rome_codes.length > 0) done.add(3);
  if (profile.diploma_level !== null) done.add(4);
  if (profile.location_lat !== null && profile.location_lng !== null) done.add(5);
  if (filled(profile.first_name) && filled(profile.last_name)) done.add(ACCOUNT_STEP);
  // The documents are optional: the step is done once both are there or the student skipped it (C89).
  if ((hasCv && hasLetter) || profile.documents_skipped_at !== null) done.add(DOCUMENTS_STEP);
  if (profile.onboarding_completed) done.add(LAST_STEP);
  return done;
}

/** The step to show next; LAST_STEP once everything before it is done. */
export function firstIncompleteStep(snapshot: OnboardingSnapshot): number {
  const done = completedSteps(snapshot);
  return ONBOARDING_STEPS.find(({ step }) => !done.has(step))?.step ?? LAST_STEP;
}

/** Steps can be revisited, never skipped. */
export function isStepAccessible(step: number, snapshot: OnboardingSnapshot): boolean {
  return Number.isInteger(step) && step >= 1 && step <= firstIncompleteStep(snapshot);
}

export function parseStep(value: string): number | null {
  const step = Number(value);
  return Number.isInteger(step) && step >= 1 && step <= LAST_STEP ? step : null;
}

export function stepTitle(step: number): string {
  return ONBOARDING_STEPS.find((item) => item.step === step)?.title ?? "";
}

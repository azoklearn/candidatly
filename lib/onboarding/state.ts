import type { Tables } from "@/lib/supabase/database.types";

/**
 * The questionnaire (docs/QUESTIONS.md C92 to C94, C111): five questions answered with the
 * thumb, the analysis screen, then the account. The CV is dropped on the landing page, not
 * at the end. Visitors go through the
 * questions and the analysis without an account; their answers wait in a cookie (C91).
 * The questionnaire says "tu", like the landing page visitors arrive from.
 */

export const ONBOARDING_STEPS = [
  { step: 1, title: "Tu cherches quoi ?" },
  { step: 2, title: "C’est quoi ton domaine ?" },
  { step: 3, title: "Quels métiers ?" },
  { step: 4, title: "T’en es où dans tes études ?" },
  { step: 5, title: "Tu veux bosser où ?" },
  { step: 6, title: "Ton compte" },
] as const;

export const LAST_STEP = ONBOARDING_STEPS.length;
/** Everything a visitor can answer before the account exists. */
export const VISITOR_LAST_STEP = 5;
export const ACCOUNT_STEP = 6;
export const ACCOUNT_STEP_PATH = "/onboarding/compte";
/**
 * Closes the questionnaire once every step is answered and opens the result (C111): the
 * step that asked for the CV is gone, the CV is dropped on the landing page.
 */
export const FINISH_PATH = "/onboarding/fin";
/**
 * The analysis sits between the questions and the account (docs/QUESTIONS.md C94): the
 * student sees what the search found before being asked to sign up.
 */
export const ANALYSIS_PATH = "/onboarding/analyse";
/**
 * A CV read on the landing page replaces the five questions by one screen (C100): what we
 * understood, corrected in place. Visitors who drop no CV keep the questions one by one.
 */
export const RECAP_PATH = "/onboarding/profil";

/**
 * Where a student goes once their CV has been read: the confirmation screen as soon as a
 * field was recognised, and otherwise the question they stopped at, as any other visitor.
 */
export function nextAfterScan({ hasDomain, step }: { hasDomain: boolean; step: number }): string {
  if (hasDomain) return RECAP_PATH;
  return step > VISITOR_LAST_STEP ? ANALYSIS_PATH : `/onboarding/${step}`;
}

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
>;

export type OnboardingSnapshot = {
  profile: OnboardingProfile;
  /** Kept for the account page; the questionnaire no longer asks for documents (C111). */
  hasCv: boolean;
  hasLetter: boolean;
};

const filled = (value: string | null) => (value ?? "").trim().length > 0;

export function completedSteps({ profile }: OnboardingSnapshot): Set<number> {
  const done = new Set<number>();
  if (profile.contract_chosen_at !== null) done.add(1);
  if (filled(profile.domain_free_text)) done.add(2);
  if (profile.rome_codes.length > 0) done.add(3);
  if (profile.diploma_level !== null) done.add(4);
  if (profile.location_lat !== null && profile.location_lng !== null) done.add(5);
  if (filled(profile.first_name) && filled(profile.last_name)) done.add(ACCOUNT_STEP);
  return done;
}

/** The step to show next; LAST_STEP once everything before it is done. */
export function firstIncompleteStep(snapshot: OnboardingSnapshot): number {
  const done = completedSteps(snapshot);
  return ONBOARDING_STEPS.find(({ step }) => !done.has(step))?.step ?? LAST_STEP;
}

/** Every step answered: the questionnaire can close. */
export function isQuestionnaireDone(snapshot: OnboardingSnapshot): boolean {
  return completedSteps(snapshot).size === ONBOARDING_STEPS.length;
}

/** Where to go next: the first unanswered step, or the end of the questionnaire. */
export function nextOnboardingPath(snapshot: OnboardingSnapshot): string {
  return isQuestionnaireDone(snapshot)
    ? FINISH_PATH
    : `/onboarding/${firstIncompleteStep(snapshot)}`;
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

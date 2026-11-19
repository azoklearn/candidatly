import type { Tables } from "@/lib/supabase/database.types";

/**
 * The questionnaire (docs/QUESTIONS.md C92 to C94, C111, C118): nine questions answered
 * with the thumb, the analysis screen, then the account. The first five say what to search
 * (a CV dropped on the landing page answers them at once); the next four shape the plan.
 * Visitors go through the questions and the analysis without an account; their answers
 * wait in a cookie (C91). The questionnaire says "tu", like the landing page visitors
 * arrive from.
 */

export const ONBOARDING_STEPS: readonly { step: number; title: string; hint?: string }[] = [
  { step: 1, title: "Tu cherches quoi ?" },
  { step: 2, title: "C’est quoi ton domaine ?" },
  { step: 3, title: "Quels métiers ?" },
  { step: 4, title: "T’en es où dans tes études ?" },
  { step: 5, title: "Tu veux bosser où ?" },
  { step: 6, title: "Tu en es où ?", hint: "Pour un plan qui colle à ta situation." },
  {
    step: 7,
    title: "Tu veux commencer quand ?",
    hint: "Ça fixe ton objectif. Tu pourras le changer.",
  },
  {
    step: 8,
    title: "Tu envoies combien de candidatures par semaine ?",
    hint: "Réponds franchement, ça sert juste à régler ton plan.",
  },
  { step: 9, title: "Qu’est-ce qui te bloque le plus ?", hint: "Ton plan commencera par là." },
  { step: 10, title: "Ton compte" },
];

export const LAST_STEP = ONBOARDING_STEPS.length;
/** The answers the search needs: a CV read on the landing page fills them together. */
export const SEARCH_LAST_STEP = 5;
/** Everything a visitor can answer before the account exists. */
export const VISITOR_LAST_STEP = 9;
export const ACCOUNT_STEP = 10;
/** The pause between two questions that shows what JobGPT does in the student's place. */
export const GAIN_PATH = "/onboarding/gain";
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
  | "situation"
  | "start_timing"
  | "weekly_applications"
  | "main_blocker"
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
  if (profile.situation !== null) done.add(6);
  if (profile.start_timing !== null) done.add(7);
  if (profile.weekly_applications !== null) done.add(8);
  if (profile.main_blocker !== null) done.add(9);
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

/**
 * Where a question leads once it is answered: the next question still open, or the
 * analysis when the visitor has nothing left to answer (the account comes after it, C94).
 */
export function nextQuestionPath(snapshot: OnboardingSnapshot): string {
  const step = firstIncompleteStep(snapshot);
  return step <= VISITOR_LAST_STEP && !isQuestionnaireDone(snapshot)
    ? `/onboarding/${step}`
    : ANALYSIS_PATH;
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

export function stepHint(step: number): string | null {
  return ONBOARDING_STEPS.find((item) => item.step === step)?.hint ?? null;
}

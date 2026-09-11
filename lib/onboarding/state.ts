import type { Tables } from "@/lib/supabase/database.types";

/** Onboarding steps (brief section 5.1) and progress rules. Step 1, the account, is done at sign-up. */

export const ONBOARDING_STEPS = [
  { step: 1, title: "Bienvenue !" },
  { step: 2, title: "Parlons de vous" },
  { step: 3, title: "Quel métier vous attire ?" },
  { step: 4, title: "Où voulez-vous travailler ?" },
  { step: 5, title: "Votre CV et votre lettre" },
  { step: 6, title: "C’est prêt !" },
] as const;

export const LAST_STEP = ONBOARDING_STEPS.length;

export type OnboardingProfile = Pick<
  Tables<"profiles">,
  | "first_name"
  | "last_name"
  | "school"
  | "degree_label"
  | "diploma_level"
  | "rome_codes"
  | "location_lat"
  | "location_lng"
  | "onboarding_completed"
>;

export type OnboardingSnapshot = { profile: OnboardingProfile; hasCv: boolean; hasLetter: boolean };

const filled = (value: string | null) => (value ?? "").trim().length > 0;

export function completedSteps({ profile, hasCv, hasLetter }: OnboardingSnapshot): Set<number> {
  const done = new Set<number>([1]);
  if (
    filled(profile.first_name) &&
    filled(profile.last_name) &&
    filled(profile.school) &&
    filled(profile.degree_label) &&
    profile.diploma_level !== null
  ) {
    done.add(2);
  }
  if (profile.rome_codes.length > 0) done.add(3);
  if (profile.location_lat !== null && profile.location_lng !== null) done.add(4);
  if (hasCv && hasLetter) done.add(5);
  if (profile.onboarding_completed) done.add(6);
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

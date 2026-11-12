import Link from "next/link";

import { LAST_STEP, stepTitle, VISITOR_LAST_STEP } from "@/lib/onboarding/state";

/** Five questions, then the account and the documents: the count shown says so. */
export function stepLabel(step: number): string {
  if (step <= VISITOR_LAST_STEP) return `Question ${step} sur ${VISITOR_LAST_STEP}`;
  if (step === LAST_STEP) return "Dernière étape";
  return "Plus qu’un pas";
}

export function StepHeader({ step }: { step: number }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 grid gap-3 bg-background/90 px-4 pt-2 pb-4 backdrop-blur-md sm:static sm:mx-0 sm:mb-8 sm:gap-4 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{stepLabel(step)}</span>
        {/* No way back while the analysis runs: it is already writing the profile. */}
        {step > 1 && step < LAST_STEP ? (
          <Link
            href={`/onboarding/${step - 1}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <span aria-hidden>← </span>Retour
          </Link>
        ) : null}
      </div>
      {/* One segment per question, like the bars of a story; the current one fills up. */}
      <div className="q-segments" aria-hidden>
        {Array.from({ length: VISITOR_LAST_STEP }, (_, index) => (
          <span
            key={index}
            data-state={index + 1 < step ? "done" : index + 1 === step ? "now" : "todo"}
          />
        ))}
      </div>
      <h1 className="page-title q-in">{stepTitle(step)}</h1>
    </header>
  );
}

import Link from "next/link";

import { LAST_STEP, stepHint, stepTitle, VISITOR_LAST_STEP } from "@/lib/onboarding/state";

/** Nine questions, then the account: the count shown says so. */
export function stepLabel(step: number): string {
  if (step <= VISITOR_LAST_STEP) return `Question ${step} sur ${VISITOR_LAST_STEP}`;
  if (step === LAST_STEP) return "Dernière étape";
  return "Plus qu’un pas";
}

export function StepHeader({ step }: { step: number }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-6 grid gap-3 border-b border-white/70 bg-[rgb(255_250_245/0.62)] px-4 pt-3 pb-4 backdrop-blur-xl backdrop-saturate-150 sm:static sm:mx-0 sm:mb-8 sm:gap-4 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-filter-none">
      <div className="flex items-center justify-between">
        <span className="text-[0.8125rem] font-semibold text-muted-foreground tabular-nums">
          {stepLabel(step)}
        </span>
        {/* No way back while the analysis runs: it is already writing the profile. */}
        {step > 1 && step < LAST_STEP ? (
          <Link
            href={`/onboarding/${step - 1}`}
            className="btn-glass rounded-full px-3 py-1 text-[0.8125rem] font-semibold text-muted-foreground hover:text-foreground"
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
      <div className="q-in grid gap-2">
        <h1 className="page-title">{stepTitle(step)}</h1>
        {stepHint(step) ? (
          <p className="text-[0.9375rem] text-muted-foreground">{stepHint(step)}</p>
        ) : null}
      </div>
    </header>
  );
}

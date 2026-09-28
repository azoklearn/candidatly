import Link from "next/link";

import { LAST_STEP, stepTitle } from "@/lib/onboarding/state";

export function StepHeader({ step }: { step: number }) {
  return (
    <header className="fade-up mb-8 grid gap-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">
          Étape {step} sur {LAST_STEP}
        </span>
        {step > 1 ? (
          <Link
            href={`/onboarding/${step - 1}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <span aria-hidden>← </span>Retour
          </Link>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10" aria-hidden>
        <div
          className="h-full rounded-full bg-linear-to-r from-brand-soft to-brand transition-[width] duration-500"
          style={{ width: `${(step / LAST_STEP) * 100}%` }}
        />
      </div>
      <h1 className="page-title">{stepTitle(step)}</h1>
    </header>
  );
}

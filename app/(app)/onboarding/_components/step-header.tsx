import Link from "next/link";

import { LAST_STEP, stepTitle } from "@/lib/onboarding/state";

export function StepHeader({ step }: { step: number }) {
  return (
    <header className="mb-8 grid gap-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Étape {step} sur {LAST_STEP}
        </span>
        {step > 1 ? (
          <Link href={`/onboarding/${step - 1}`} className="underline underline-offset-4">
            Retour
          </Link>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(step / LAST_STEP) * 100}%` }}
        />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{stepTitle(step)}</h1>
    </header>
  );
}

import type { CSSProperties } from "react";

import type { Plan } from "@/lib/onboarding/plan";

/**
 * The student's plan, built from their own answers (docs/QUESTIONS.md C118): a goal with
 * its date, a weekly rhythm, and where we start. Advice, never a promised result.
 */
export function PlanCard({ plan }: { plan: Plan }) {
  const lines = [
    { label: "Ton objectif", ...plan.goal },
    { label: "Ton rythme", ...plan.rhythm },
    { label: "Par où on commence", ...plan.first },
  ];
  return (
    <section
      aria-label="Ton plan"
      className="panel fade-up grid w-full max-w-xl gap-0 rounded-[1.75rem] border bg-card p-2 text-left"
    >
      <h2 className="px-4 pt-3 pb-1 font-heading text-lg font-semibold tracking-[-0.03em]">
        Ton plan
      </h2>
      <ol className="notebook grid">
        {lines.map((line, index) => (
          <li
            key={line.label}
            style={{ "--i": index } as CSSProperties}
            className="rise flex items-start gap-3.5 px-4 py-3.5"
          >
            <span
              aria-hidden
              className="plan-badge grid size-7 shrink-0 place-items-center rounded-full font-heading text-sm font-semibold"
            >
              {index + 1}
            </span>
            <span className="grid gap-0.5">
              <span className="text-xs font-semibold text-muted-foreground">{line.label}</span>
              <span className="font-heading text-[1.0625rem] leading-snug font-semibold tracking-[-0.02em]">
                {line.title}
              </span>
              <span className="text-sm leading-snug text-muted-foreground">{line.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

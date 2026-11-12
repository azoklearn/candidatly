"use client";

import Link from "next/link";
import { useActionState, useState, type CSSProperties } from "react";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { saveRome, type FormState } from "../actions";

export type JobOption = { code: string; label: string };
const MAX_CODES = 5;

/** Step 3: the jobs of the chosen domain, ticked with a click (docs/QUESTIONS.md C92). */
export function JobStep({
  domainLabel,
  jobs,
  selected,
}: {
  domainLabel: string;
  jobs: readonly JobOption[];
  selected: readonly string[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRome, {});
  const [checked, setChecked] = useState<string[]>([...selected]);

  function toggle(code: string) {
    setChecked((current) =>
      current.includes(code)
        ? current.filter((value) => value !== code)
        : current.length >= MAX_CODES
          ? current
          : [...current, code],
    );
  }

  return (
    <ActionForm action={action} className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        {domainLabel} · choisis-en jusqu’à {MAX_CODES}.{" "}
        <Link href="/onboarding/2" className="underline underline-offset-4">
          Changer de domaine
        </Link>
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {jobs.map((job, index) => {
          const isChecked = checked.includes(job.code);
          const full = !isChecked && checked.length >= MAX_CODES;
          return (
            <li key={job.code} className="q-in" style={{ "--i": index } as CSSProperties}>
              <label
                className={cn(
                  "q-card panel relative flex h-full min-h-14 cursor-pointer items-center gap-3 rounded-[1.2rem] border bg-card px-4 py-3 text-[0.95rem] hover:border-foreground/60",
                  isChecked && "border-brand bg-[var(--pastel-peach)]/45",
                  full && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  name="rome_codes"
                  value={job.code}
                  checked={isChecked}
                  disabled={full}
                  onChange={() => toggle(job.code)}
                  className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <span aria-hidden className="q-check">
                  ✓
                </span>
                <span className="leading-snug font-medium">{job.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {/* Always under the thumb: the list is long on a phone. */}
      <div className="sticky bottom-3 z-20 flex items-center gap-3 rounded-full border bg-card/95 p-1.5 pl-4 shadow-[0_14px_30px_rgba(74,46,28,0.16)] backdrop-blur-md sm:static sm:w-fit sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <span className="text-sm font-medium text-muted-foreground tabular-nums sm:hidden">
          {checked.length} / {MAX_CODES}
        </span>
        <Button
          type="submit"
          size="lg"
          variant="shiny"
          disabled={pending || checked.length === 0}
          className="h-11 flex-1 px-7 sm:flex-none"
        >
          {pending ? "Enregistrement…" : "Continuer"} <span aria-hidden>→</span>
        </Button>
      </div>
    </ActionForm>
  );
}

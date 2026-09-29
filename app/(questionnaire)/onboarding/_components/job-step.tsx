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
                  "q-card flex h-full min-h-16 cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4 text-sm hover:bg-muted/40",
                  isChecked && "border-foreground bg-primary/5",
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
                  className="mt-0.5 size-4 accent-primary"
                />
                <span className="font-medium">{job.label}</span>
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
      <Button type="submit" size="lg" disabled={pending || checked.length === 0} className="w-fit">
        {pending ? "Enregistrement…" : "Continuer"}
      </Button>
    </ActionForm>
  );
}

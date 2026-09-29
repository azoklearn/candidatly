"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

/** One question, one click: each card submits its own value (docs/QUESTIONS.md C92). */

export type Choice = { value: string; label: string; hint?: string };

function ChoiceCard({
  choice,
  selected,
  index,
}: {
  choice: Choice;
  selected: boolean;
  index: number;
}) {
  const { pending, data } = useFormStatus();
  const chosen = pending && data?.get("value") === choice.value;
  return (
    <button
      type="submit"
      name="value"
      value={choice.value}
      disabled={pending}
      style={{ "--i": index } as CSSProperties}
      className={cn(
        "q-card q-in group flex min-h-16 items-center justify-between gap-4 rounded-2xl border bg-card p-4 text-left",
        "hover:border-foreground hover:bg-muted/40 disabled:opacity-60",
        selected && "border-foreground bg-primary/5",
        chosen && "border-brand bg-primary/5",
      )}
    >
      <span className="grid gap-0.5">
        <span className="font-medium text-[1.0625rem] sm:text-base">{choice.label}</span>
        {choice.hint ? <span className="text-sm text-muted-foreground">{choice.hint}</span> : null}
      </span>
      <span
        aria-hidden
        className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
      >
        {chosen ? "…" : "→"}
      </span>
    </button>
  );
}

export function ChoiceCards({
  action,
  choices,
  selected,
  columns = 1,
}: {
  action: (formData: FormData) => Promise<void>;
  choices: readonly Choice[];
  selected?: string | null;
  columns?: 1 | 2;
}) {
  return (
    <form action={action} className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
      {choices.map((choice, index) => (
        <ChoiceCard
          key={choice.value}
          choice={choice}
          index={index}
          selected={selected === choice.value}
        />
      ))}
    </form>
  );
}

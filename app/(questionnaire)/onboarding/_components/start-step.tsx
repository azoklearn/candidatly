"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

import { saveStart } from "../actions";

/**
 * When the student wants to start (docs/QUESTIONS.md C118): one of the twelve coming
 * months, as soon as possible, or not known yet. The months are computed on the server and
 * passed down, so the page reads the same before and after it wakes up.
 */

const OTHERS = [
  { value: "asap", icon: "⚡", label: "Dès que possible", hint: "Ou ça a déjà commencé" },
  { value: "unknown", icon: "🤷", label: "Je ne sais pas encore" },
] as const;

function Options({
  months,
  chosen,
}: {
  months: readonly { value: string; label: string }[];
  chosen: string | null;
}) {
  const { pending, data } = useFormStatus();
  const sent = pending ? data?.get("value") : null;
  const picked = (value: string) => (sent ? sent === value : chosen === value);
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {months.map((month, index) => (
          <button
            key={month.value}
            type="submit"
            name="value"
            value={month.value}
            disabled={pending}
            style={{ "--i": index } as CSSProperties}
            data-on={picked(month.value) ? "true" : undefined}
            className="q-card q-in chip min-h-12 rounded-2xl px-2 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {month.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        {OTHERS.map((option, index) => (
          <button
            key={option.value}
            type="submit"
            name="value"
            value={option.value}
            disabled={pending}
            style={{ "--i": months.length + index } as CSSProperties}
            data-picked={picked(option.value) ? "true" : undefined}
            className={cn(
              "q-card q-in panel group flex min-h-[4.25rem] items-center gap-4 rounded-[1.5rem] border bg-card p-3.5 pr-4 text-left",
              "disabled:opacity-60",
            )}
          >
            <span
              aria-hidden
              className="q-tile"
              style={
                {
                  "--tile": index === 0 ? "var(--pastel-sun)" : "var(--pastel-lilac)",
                } as CSSProperties
              }
            >
              {option.icon}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-heading text-[1.0625rem] leading-tight font-semibold tracking-[-0.02em]">
                {option.label}
              </span>
              {"hint" in option ? (
                <span className="text-sm leading-snug text-muted-foreground">{option.hint}</span>
              ) : null}
            </span>
            <span aria-hidden className="q-go">
              {picked(option.value) ? "✓" : "→"}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export function StartStep({
  months,
  chosen,
}: {
  months: readonly { value: string; label: string }[];
  chosen: string | null;
}) {
  return (
    <form action={saveStart} className="grid gap-4">
      <Options months={months} chosen={chosen} />
    </form>
  );
}

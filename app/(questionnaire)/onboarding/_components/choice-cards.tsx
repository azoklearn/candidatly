"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

/** One question, one click: each card submits its own value (docs/QUESTIONS.md C92). */

/** `icon` is a short mark drawn in a pastel tile: an emoji, or two or three characters. */
export type Choice = { value: string; label: string; hint?: string; icon?: string };

/** The six stationery pastels, one per card in turn. */
const TILES = [
  "var(--pastel-peach)",
  "var(--pastel-sun)",
  "var(--pastel-mint)",
  "var(--pastel-lilac)",
  "var(--pastel-rose)",
  "var(--pastel-sky)",
] as const;

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
      style={{ "--i": index, "--tile": TILES[index % TILES.length] } as CSSProperties}
      data-picked={selected || chosen ? "true" : undefined}
      className={cn(
        "q-card q-in panel group flex min-h-[4.5rem] items-center gap-3.5 rounded-[1.35rem] border bg-card p-3.5 text-left",
        "hover:border-foreground/60 disabled:opacity-60",
        (selected || chosen) && "border-brand bg-[var(--pastel-peach)]/45",
      )}
    >
      {choice.icon ? (
        <span aria-hidden className="q-tile">
          {choice.icon}
        </span>
      ) : null}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-heading text-[1.0625rem] leading-tight font-semibold tracking-[-0.02em]">
          {choice.label}
        </span>
        {choice.hint ? (
          <span className="text-sm leading-snug text-muted-foreground">{choice.hint}</span>
        ) : null}
      </span>
      <span aria-hidden className="q-go">
        {chosen ? "…" : selected ? "✓" : "→"}
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

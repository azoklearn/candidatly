import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Native select and textarea styled like the shadcn Input, plus field helpers. */
export const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

export const textareaClassName =
  "min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export type Choice = { value: string; label: string; hint?: string };

/** Radio buttons shown as cards: one tap per answer in the questionnaire. */
export function ChoiceGroup({
  name,
  legend,
  options,
  defaultValue,
  error,
  gridClassName,
}: {
  name: string;
  legend: string;
  options: readonly Choice[];
  defaultValue?: string | null;
  error?: string;
  gridClassName?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <fieldset className="grid gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn("grid gap-2", gridClassName)}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="mt-0.5 size-4 accent-primary"
            />
            <span className="grid gap-0.5">
              <span className="font-medium">{option.label}</span>
              {option.hint ? <span className="text-muted-foreground">{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

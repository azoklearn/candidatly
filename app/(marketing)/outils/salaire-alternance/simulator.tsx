"use client";

import { useState } from "react";

import { AGE_BRACKETS, AGE_LABELS, minimumPay, type AgeBracket } from "@/lib/tools/apprentice-pay";

/**
 * Minimum pay of a work-study student, computed in the browser from the legal grid
 * (docs/QUESTIONS.md C122). Three clicks, no account, nothing sent anywhere.
 */

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
type Contract = "apprentissage" | "professionnalisation";

function Chips<T extends string | number | boolean>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className="q-card chip min-h-11 rounded-full px-4 py-2 text-sm"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SalarySimulator() {
  const [contract, setContract] = useState<Contract>("apprentissage");
  const [age, setAge] = useState<AgeBracket>("18-20");
  const [year, setYear] = useState<1 | 2 | 3>(1);
  const [qualified, setQualified] = useState(false);
  const result =
    contract === "apprentissage"
      ? minimumPay({ contract, age, year })
      : minimumPay({ contract, age, qualified });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="panel grid gap-6 rounded-[1.75rem] border bg-card p-5 sm:p-7">
        <Chips
          legend="Ton contrat"
          value={contract}
          onChange={setContract}
          options={[
            { value: "apprentissage", label: "Apprentissage" },
            { value: "professionnalisation", label: "Professionnalisation" },
          ]}
        />
        <Chips
          legend="Ton âge"
          value={age}
          onChange={setAge}
          options={AGE_BRACKETS.map((bracket) => ({ value: bracket, label: AGE_LABELS[bracket] }))}
        />
        {contract === "apprentissage" ? (
          <Chips
            legend="Ton année de contrat"
            value={year}
            onChange={setYear}
            options={[
              { value: 1, label: "1re année" },
              { value: 2, label: "2e année" },
              { value: 3, label: "3e année" },
            ]}
          />
        ) : (
          <Chips
            legend="Tu as déjà un bac professionnel, ou un titre ou diplôme de ce niveau ou plus ?"
            value={qualified}
            onChange={setQualified}
            options={[
              { value: true, label: "Oui" },
              { value: false, label: "Non" },
            ]}
          />
        )}
      </div>

      <div
        className="plan-featured panel grid gap-2 rounded-[1.75rem] border bg-card p-6 text-center"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-muted-foreground">Ton minimum légal</p>
        <p className="font-heading text-5xl font-semibold tracking-[-0.055em] tabular-nums">
          {euros.format(result.monthlyCents / 100)}
        </p>
        <p className="text-sm text-muted-foreground">brut par mois, à temps plein</p>
        <p className="mt-1 text-sm font-semibold text-brand">soit {result.percent} % du Smic</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {result.agreementMayApply
            ? "À partir de 21 ans, c’est le minimum prévu par la convention collective du poste qui compte s’il est plus élevé."
            : "C’est un plancher : ta convention collective ou ton employeur peut prévoir plus."}
        </p>
      </div>
    </div>
  );
}

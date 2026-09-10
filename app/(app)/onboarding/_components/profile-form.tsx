"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveProfile, type FormState } from "../actions";
import { FieldError, FieldHint, selectClassName } from "./fields";

type ProfileValues = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  school: string | null;
  degree_label: string | null;
  diploma_level: string | null;
  target_contract: string;
  availability_date: string | null;
};

const LEVELS = [
  ["bac", "Bac"],
  ["bac+2", "Bac+2 (BTS, BUT 2e année…)"],
  ["bac+3", "Bac+3 (licence, BUT, bachelor…)"],
  ["bac+4", "Bac+4 (master 1…)"],
  ["bac+5", "Bac+5 (master, école d’ingénieur ou de commerce…)"],
] as const;

export function ProfileForm({ profile }: { profile: ProfileValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const errors = state.fieldErrors ?? {};

  const text = (
    name: keyof ProfileValues,
    label: string,
    options: { autoComplete?: string; type?: string; hint?: string } = {},
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={options.type ?? "text"}
        autoComplete={options.autoComplete}
        defaultValue={profile[name] ?? ""}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
      {options.hint ? <FieldHint>{options.hint}</FieldHint> : null}
      <FieldError id={`${name}-error`} message={errors[name]} />
    </div>
  );

  return (
    <ActionForm action={action} className="grid gap-5">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {text("first_name", "Prénom", { autoComplete: "given-name" })}
        {text("last_name", "Nom", { autoComplete: "family-name" })}
      </div>
      {text("school", "École ou université", { autoComplete: "organization" })}
      {text("degree_label", "Formation préparée en alternance", {
        hint: "Par exemple : BUT Information-Communication.",
      })}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="diploma_level">Niveau du diplôme préparé</Label>
          <select
            id="diploma_level"
            name="diploma_level"
            defaultValue={profile.diploma_level ?? ""}
            className={selectClassName}
            aria-invalid={Boolean(errors.diploma_level)}
            aria-describedby={errors.diploma_level ? "diploma_level-error" : undefined}
          >
            <option value="" disabled>
              Choisir
            </option>
            {LEVELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError id="diploma_level-error" message={errors.diploma_level} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="target_contract">Type de contrat recherché</Label>
          <select
            id="target_contract"
            name="target_contract"
            defaultValue={profile.target_contract}
            className={selectClassName}
          >
            <option value="alternance">Alternance</option>
            <option value="stage">Stage (bientôt disponible)</option>
            <option value="both">Alternance et stage</option>
          </select>
          <FieldError id="target_contract-error" message={errors.target_contract} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {text("availability_date", "Disponible à partir du", { type: "date" })}
        {text("phone", "Téléphone (facultatif)", {
          type: "tel",
          autoComplete: "tel",
          hint: "Utile pour les relances.",
        })}
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Enregistrement…" : "Continuer"}
      </Button>
    </ActionForm>
  );
}

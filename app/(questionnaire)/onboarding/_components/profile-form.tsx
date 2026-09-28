"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveProfile, type FormState } from "../actions";
import { ChoiceGroup, FieldError, FieldHint, type Choice } from "./fields";

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

const LEVELS: Choice[] = [
  { value: "bac", label: "Bac", hint: "Bac professionnel, brevet professionnel…" },
  { value: "bac+2", label: "Bac+2", hint: "BTS, BUT 2e année…" },
  { value: "bac+3", label: "Bac+3", hint: "Licence, BUT, bachelor…" },
  { value: "bac+4", label: "Bac+4", hint: "Master 1…" },
  { value: "bac+5", label: "Bac+5", hint: "Master, école d’ingénieur ou de commerce…" },
];

const CONTRACTS: Choice[] = [
  { value: "alternance", label: "Une alternance" },
  { value: "stage", label: "Un stage", hint: "Offres bientôt disponibles" },
  { value: "both", label: "Les deux" },
];

/**
 * The full profile, on the account page. The questionnaire itself asks the same things
 * with clicks, one question per screen (docs/QUESTIONS.md C92); the school and the course
 * are optional and only live here.
 */
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
    <ActionForm action={action} className="grid gap-6">
      <input type="hidden" name="mode" value="account" />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {text("first_name", "Prénom", { autoComplete: "given-name" })}
        {text("last_name", "Nom", { autoComplete: "family-name" })}
      </div>
      {text("school", "École ou université (facultatif)", { autoComplete: "organization" })}
      {text("degree_label", "Formation préparée (facultatif)", {
        hint: "Par exemple : BUT Information-Communication.",
      })}
      <ChoiceGroup
        name="diploma_level"
        legend="Niveau du diplôme préparé"
        options={LEVELS}
        defaultValue={profile.diploma_level}
        error={errors.diploma_level}
        gridClassName="sm:grid-cols-2"
      />
      <ChoiceGroup
        name="target_contract"
        legend="Type de contrat"
        options={CONTRACTS}
        defaultValue={profile.target_contract}
        error={errors.target_contract}
        gridClassName="sm:grid-cols-3"
      />
      {text("availability_date", "Disponible à partir du", { type: "date", hint: "Facultatif." })}
      {text("phone", "Téléphone (facultatif)", {
        type: "tel",
        autoComplete: "tel",
        hint: "Utile pour les relances.",
      })}
      {state.saved ? (
        <p className="text-sm text-muted-foreground">Modifications enregistrées.</p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </ActionForm>
  );
}

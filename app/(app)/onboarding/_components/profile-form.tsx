"use client";

import { useActionState, useRef, useState } from "react";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

/** In the questionnaire, the profile is asked as three short questions, one per screen. */
const SCREENS = [
  {
    title: "Comment vous appelez-vous ?",
    fields: ["first_name", "last_name"],
    required: ["first_name", "last_name"],
  },
  {
    title: "Qu’allez-vous étudier ?",
    fields: ["school", "degree_label", "diploma_level"],
    required: ["school", "degree_label", "diploma_level"],
  },
  {
    title: "Que cherchez-vous ?",
    fields: ["target_contract", "availability_date", "phone"],
    required: ["target_contract"],
  },
] as const;

export function ProfileForm({
  profile,
  mode = "onboarding",
}: {
  profile: ProfileValues;
  mode?: "onboarding" | "account";
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const [screen, setScreen] = useState(0);
  const [missing, setMissing] = useState(false);
  const marker = useRef<HTMLSpanElement>(null);
  const errors = state.fieldErrors ?? {};
  const stepped = mode === "onboarding";
  const errorScreen = SCREENS.findIndex((item) =>
    item.fields.some((field) => Boolean(errors[field])),
  );
  const lastScreen = SCREENS.length - 1;

  const screenClass = (index: number) => cn("grid gap-5", stepped && screen !== index && "hidden");

  function next() {
    const form = marker.current?.closest("form");
    const current = SCREENS[screen];
    if (!form || !current) return;
    const data = new FormData(form);
    if (current.required.some((field) => !String(data.get(field) ?? "").trim())) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setScreen(Math.min(screen + 1, lastScreen));
  }

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
      <span ref={marker} hidden />
      <input type="hidden" name="mode" value={mode} />
      {stepped ? <input type="hidden" name="phone" value={profile.phone ?? ""} /> : null}
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {stepped && errorScreen >= 0 && errorScreen !== screen ? (
        <Alert variant="destructive">
          <AlertDescription className="grid gap-2">
            Une réponse est à corriger.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setScreen(errorScreen)}
            >
              Voir la question
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {stepped ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Question {screen + 1} sur {SCREENS.length}
        </p>
      ) : null}

      <div className={screenClass(0)}>
        {stepped ? <h2 className="text-lg font-medium">{SCREENS[0].title}</h2> : null}
        <div className="grid gap-5 sm:grid-cols-2">
          {text("first_name", "Prénom", { autoComplete: "given-name" })}
          {text("last_name", "Nom", { autoComplete: "family-name" })}
        </div>
      </div>

      <div className={screenClass(1)}>
        {stepped ? <h2 className="text-lg font-medium">{SCREENS[1].title}</h2> : null}
        {text("school", "École ou université", { autoComplete: "organization" })}
        {text("degree_label", "Formation préparée", {
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
      </div>

      <div className={screenClass(2)}>
        {stepped ? <h2 className="text-lg font-medium">{SCREENS[2].title}</h2> : null}
        <ChoiceGroup
          name="target_contract"
          legend="Type de contrat"
          options={CONTRACTS}
          defaultValue={profile.target_contract}
          error={errors.target_contract}
          gridClassName="sm:grid-cols-3"
        />
        {text("availability_date", "Disponible à partir du", { type: "date", hint: "Facultatif." })}
        {!stepped
          ? text("phone", "Téléphone (facultatif)", {
              type: "tel",
              autoComplete: "tel",
              hint: "Utile pour les relances.",
            })
          : null}
      </div>

      {missing ? (
        <p role="alert" className="text-sm text-destructive">
          Répondez à la question pour continuer.
        </p>
      ) : null}
      {state.saved ? (
        <p className="text-sm text-muted-foreground">Modifications enregistrées.</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {stepped && screen > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              setMissing(false);
              setScreen(screen - 1);
            }}
          >
            Précédent
          </Button>
        ) : null}
        {stepped && screen < lastScreen ? (
          <Button type="button" size="lg" onClick={next}>
            Suivant
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Enregistrement…" : mode === "account" ? "Enregistrer" : "Continuer"}
          </Button>
        )}
      </div>
    </ActionForm>
  );
}

"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveIdentity, type FormState } from "../actions";
import { FieldError } from "./fields";

/** Step 6 for a student who already has an account: only the name is missing. */
export function IdentityStep({
  firstName,
  lastName,
}: {
  firstName: string | null;
  lastName: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveIdentity, {});
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        Votre nom apparaîtra sur vos lettres de motivation.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="first_name">Prénom</Label>
          <Input
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            defaultValue={firstName ?? ""}
            aria-invalid={Boolean(errors.first_name)}
          />
          <FieldError id="first_name-error" message={errors.first_name} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="last_name">Nom</Label>
          <Input
            id="last_name"
            name="last_name"
            autoComplete="family-name"
            defaultValue={lastName ?? ""}
            aria-invalid={Boolean(errors.last_name)}
          />
          <FieldError id="last_name-error" message={errors.last_name} />
        </div>
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending ? "Enregistrement…" : "Continuer"}
      </Button>
    </ActionForm>
  );
}

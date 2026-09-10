"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AuthFormState } from "./actions";

type CredentialsFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  mode: "sign-in" | "sign-up";
  next?: string;
};

export function CredentialsForm({ action, mode, next }: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isSignUp = mode === "sign-up";

  if (state.message) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={8}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {state.fieldErrors.password}
          </p>
        ) : isSignUp ? (
          <p className="text-sm text-muted-foreground">8 caractères minimum.</p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Un instant…" : isSignUp ? "Créer mon compte" : "Se connecter"}
      </Button>
    </form>
  );
}

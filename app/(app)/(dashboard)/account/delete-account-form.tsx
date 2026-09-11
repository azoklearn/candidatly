"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteAccount, type DeleteAccountState } from "./actions";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});
  return (
    <ActionForm action={action} className="grid gap-3 rounded-xl border border-destructive/40 p-4">
      <h3 className="font-medium">Supprimer mon compte</h3>
      <p className="text-sm text-muted-foreground">
        Votre profil, vos documents, vos lettres, vos candidatures et votre historique sont effacés
        définitivement. Cette action est irréversible.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Tapez SUPPRIMER pour confirmer</Label>
        <Input
          id="confirm"
          name="confirm"
          autoComplete="off"
          className="sm:w-64"
          aria-invalid={Boolean(state.error)}
        />
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" variant="destructive" disabled={pending} className="w-fit">
        {pending ? "Suppression…" : "Supprimer définitivement mon compte"}
      </Button>
    </ActionForm>
  );
}

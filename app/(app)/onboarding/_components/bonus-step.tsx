"use client";

import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { finishOnboarding } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-fit">
      {pending ? "Recherche de vos offres…" : "Voir mes offres"}
    </Button>
  );
}

export function BonusStep({ failed }: { failed: boolean }) {
  return (
    <form action={finishOnboarding} className="grid gap-6">
      <p className="text-muted-foreground">
        Merci ! Nous cherchons maintenant les offres qui vous correspondent.
      </p>
      {failed ? (
        <Alert variant="destructive">
          <AlertDescription>La finalisation n’a pas abouti. Réessayez.</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton />
    </form>
  );
}

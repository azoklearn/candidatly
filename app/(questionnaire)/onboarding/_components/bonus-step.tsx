"use client";

import { useFormStatus } from "react-dom";

import { PendingOverlay } from "@/components/pending-overlay";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { finishOnboarding } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="shiny" size="lg" disabled={pending} className="w-fit">
      {pending ? "Recherche de vos offres…" : "Voir mes offres"}
      {pending ? null : <span aria-hidden>→</span>}
    </Button>
  );
}

export function BonusStep({ failed }: { failed: boolean }) {
  return (
    <form action={finishOnboarding} className="fade-up grid gap-6">
      <p className="text-lg text-muted-foreground">
        Merci ! Tout est prêt : nous cherchons maintenant les offres qui vous correspondent.
      </p>
      {failed ? (
        <Alert variant="destructive">
          <AlertDescription>La finalisation n’a pas abouti. Réessayez.</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton />
      <PendingOverlay
        title={
          <>
            On prépare votre <em>sélection</em>
          </>
        }
        messages={[
          "On lit votre profil…",
          "On cherche les offres autour de vous…",
          "On calcule vos correspondances…",
        ]}
      />
    </form>
  );
}

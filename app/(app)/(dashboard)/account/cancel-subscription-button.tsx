"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { cancelSubscription } from "./actions";

/** Stops the renewals after an explicit confirmation; the paid period stays open (C109). */
export function CancelSubscriptionButton({ periodEnd }: { periodEnd: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function stop() {
    const until = periodEnd ? ` Vous gardez l’accès jusqu’au ${periodEnd}.` : "";
    if (!window.confirm(`Arrêter votre abonnement ?${until} Aucun remboursement n’est effectué.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelSubscription();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" onClick={stop} disabled={pending} className="w-fit">
        {pending ? "Arrêt en cours…" : "Arrêter mon abonnement"}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

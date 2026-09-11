"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  markApplicationSent,
  markFollowUpDone,
  saveNotes,
  updateApplicationStatus,
  type NotesFormState,
} from "../actions";

const STATUS_CHOICES = [
  { value: "sent", label: "En attente de réponse" },
  { value: "replied_positive", label: "Réponse positive" },
  { value: "replied_negative", label: "Réponse négative" },
  { value: "no_answer", label: "Sans réponse" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  sent: "En attente de réponse",
  viewed: "En attente de réponse",
  replied_positive: "Réponse positive",
  replied_negative: "Réponse négative",
  no_answer: "Sans réponse",
  unknown: "Statut inconnu",
};

function NotesCard({ applicationId, notes }: { applicationId: string; notes: string | null }) {
  const [state, action, pending] = useActionState<NotesFormState, FormData>(
    saveNotes.bind(null, applicationId),
    {},
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>
          Contact, date d’entretien, réponse reçue : pour vous seul.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={action} className="grid gap-2">
          <label htmlFor="notes" className="sr-only">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={notes ?? ""}
            maxLength={2000}
            className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state.saved ? (
            <p className="text-sm text-muted-foreground">Notes enregistrées.</p>
          ) : null}
          <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-fit">
            {pending ? "Enregistrement…" : "Enregistrer les notes"}
          </Button>
        </ActionForm>
      </CardContent>
    </Card>
  );
}

export function ApplicationTracking({
  applicationId,
  status,
  sentLabel,
  applyUrl,
  followUp,
  notes,
}: {
  applicationId: string;
  status: string;
  sentLabel: string | null;
  applyUrl: string | null;
  followUp: string | null;
  notes: string | null;
}) {
  if (status === "draft" || status === "ready") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Envoyer votre candidature</CardTitle>
          <CardDescription>
            Vous candidatez sur le site de l’offre, avec votre lettre prête.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Copiez votre lettre avec le bouton « Copier la lettre ».</li>
            <li>Ouvrez l’offre sur son site, collez votre lettre et joignez votre CV.</li>
            <li>
              Revenez confirmer l’envoi : nous suivons votre candidature et vous proposons une
              relance au bout de 5 jours.
            </li>
          </ol>
          {applyUrl ? (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              Candidater sur le site de l’offre
            </a>
          ) : (
            <p className="text-muted-foreground">L’offre n’indique pas de lien de candidature.</p>
          )}
          <ConfirmForm
            action={markApplicationSent.bind(null, applicationId)}
            message="Confirmez-vous avoir envoyé votre candidature sur le site de l’offre ?"
          >
            <SubmitButton className="w-full" pendingLabel="Enregistrement…">
              J’ai envoyé ma candidature
            </SubmitButton>
          </ConfirmForm>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Suivi</CardTitle>
          <CardDescription>
            {sentLabel ? `Envoyée le ${sentLabel} sur le site de l’offre.` : "Candidature envoyée."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>Statut : {STATUS_LABELS[status] ?? status}</p>
          <p className="text-muted-foreground">
            Mettez le statut à jour quand vous recevez une réponse.
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_CHOICES.map((choice) => (
              <form
                key={choice.value}
                action={updateApplicationStatus.bind(null, applicationId, choice.value)}
              >
                <SubmitButton
                  size="sm"
                  variant={status === choice.value ? "default" : "outline"}
                  pendingLabel="…"
                  aria-pressed={status === choice.value}
                >
                  {choice.label}
                </SubmitButton>
              </form>
            ))}
          </div>
        </CardContent>
      </Card>
      {followUp ? (
        <Card>
          <CardHeader>
            <CardTitle>Relance conseillée</CardTitle>
            <CardDescription>
              Pas de réponse depuis 5 jours : voici un message court à envoyer au recruteur, par le
              site de l’offre ou par email.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <pre className="whitespace-pre-wrap rounded-lg border p-3 font-sans text-sm leading-relaxed">
              {followUp}
            </pre>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={followUp} label="Copier la relance" />
              <form action={markFollowUpDone.bind(null, applicationId)}>
                <SubmitButton size="sm" variant="outline" pendingLabel="…">
                  J’ai relancé
                </SubmitButton>
              </form>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <NotesCard applicationId={applicationId} notes={notes} />
    </>
  );
}

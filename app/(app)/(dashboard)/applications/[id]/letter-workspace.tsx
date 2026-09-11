"use client";

import { useActionState, useState } from "react";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { regenerateLetter, saveLetter, type LetterFormState } from "../actions";

type Segment = { type: "equal" | "insert" | "delete"; text: string; reason?: string };

function qualityLabel(confidence: number): string {
  if (confidence >= 0.85)
    return "Adaptation complète : entreprise, poste et compétences repris de l’offre.";
  if (confidence >= 0.6) return "Adaptation partielle : relisez les points ci-dessous.";
  return "Adaptation limitée : complétez la lettre vous-même.";
}

export function LetterWorkspace({
  applicationId,
  text,
  segments,
  missingInfo,
  confidence,
  regenerationsLeft,
  editable,
}: {
  applicationId: string;
  text: string;
  segments: Segment[];
  missingInfo: string[];
  confidence: number | null;
  regenerationsLeft: number;
  editable: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<LetterFormState, FormData>(
    saveLetter.bind(null, applicationId),
    {},
  );
  const reasons: string[] = [];
  const numbered = segments.map((segment) => {
    if (segment.type !== "insert" || !segment.reason) return { segment, note: 0 };
    let index = reasons.indexOf(segment.reason);
    if (index === -1) index = reasons.push(segment.reason) - 1;
    return { segment, note: index + 1 };
  });

  return (
    <section className="grid content-start gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={mode === "view" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("view")}
        >
          Voir les différences
        </Button>
        {editable ? (
          <Button
            type="button"
            variant={mode === "edit" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("edit")}
          >
            Modifier
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? "Lettre copiée" : "Copier la lettre"}
        </Button>
      </div>

      {confidence !== null ? (
        <p className="text-sm text-muted-foreground">{qualityLabel(confidence)}</p>
      ) : null}
      {missingInfo.length > 0 ? (
        <Alert>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {missingInfo.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {mode === "view" ? (
        <>
          <div className="whitespace-pre-wrap rounded-xl border p-5 text-sm leading-relaxed">
            {numbered.map(({ segment, note }, index) =>
              segment.type === "equal" ? (
                <span key={index}>{segment.text}</span>
              ) : segment.type === "delete" ? (
                <del
                  key={index}
                  className="text-muted-foreground/70 decoration-1"
                  aria-label="Passage retiré"
                >
                  {segment.text}
                </del>
              ) : (
                <mark
                  key={index}
                  title={segment.reason}
                  className="rounded bg-emerald-100 px-0.5 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-50"
                >
                  {segment.text}
                  {note > 0 ? <sup className="ml-0.5 text-[0.65rem]">{note}</sup> : null}
                </mark>
              ),
            )}
          </div>
          {reasons.length > 0 ? (
            <div className="grid gap-1 text-sm">
              <h2 className="font-medium">Pourquoi ces changements</h2>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune différence avec votre lettre de base.
            </p>
          )}
        </>
      ) : (
        <ActionForm action={action} className="grid gap-3">
          <label htmlFor="letter" className="text-sm font-medium">
            Votre lettre
          </label>
          <textarea
            key={text}
            id="letter"
            name="letter"
            defaultValue={text}
            maxLength={8000}
            className="min-h-[28rem] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state.saved ? (
            <p className="text-sm text-muted-foreground">Lettre enregistrée.</p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </ActionForm>
      )}

      {editable ? (
        <form
          action={regenerateLetter.bind(null, applicationId)}
          onSubmit={(event) => {
            if (!window.confirm("Refaire l’adaptation remplacera vos modifications. Continuer ?")) {
              event.preventDefault();
            }
          }}
          className="grid gap-1"
        >
          <SubmitButton
            variant="outline"
            size="sm"
            className="w-fit"
            pendingLabel="Adaptation…"
            disabled={regenerationsLeft <= 0}
          >
            Refaire l’adaptation ({regenerationsLeft}{" "}
            {regenerationsLeft > 1 ? "restantes" : "restante"})
          </SubmitButton>
          <p className="text-xs text-muted-foreground">
            Utile après avoir changé votre lettre de base. Vos modifications ici seront remplacées.
          </p>
        </form>
      ) : null}
    </section>
  );
}

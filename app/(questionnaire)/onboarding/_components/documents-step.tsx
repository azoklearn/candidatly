"use client";

import { useActionState, useState } from "react";

import { ActionForm } from "@/components/action-form";
import { PendingOverlay } from "@/components/pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

import {
  finishOnboarding,
  registerDocument,
  saveLetterText,
  skipDocuments,
  type FormState,
} from "../actions";
import type { DocumentSummary } from "../data";
import { FieldError, FieldHint, textareaClassName } from "./fields";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 5 * 1024 * 1024;

function mimeTypeOf(file: File): string {
  if (file.type) return file.type;
  if (/\.pdf$/i.test(file.name)) return PDF;
  if (/\.docx$/i.test(file.name)) return DOCX;
  return "";
}

type UploadStatus =
  | { state: "idle" }
  | { state: "working" }
  | { state: "error"; message: string }
  | { state: "done" };

function FileUpload({
  userId,
  kind,
  accept,
  allowed,
  label,
}: {
  userId: string;
  kind: "cv" | "cover_letter_base";
  accept: string;
  allowed: string[];
  label: string;
}) {
  const [status, setStatus] = useState<UploadStatus>({ state: "idle" });
  const inputId = `${kind}-file`;

  async function upload(file: File) {
    const mimeType = mimeTypeOf(file);
    if (!allowed.includes(mimeType)) {
      setStatus({
        state: "error",
        message:
          kind === "cv" ? "Le CV doit être un PDF." : "Utilise un PDF ou un fichier Word (.docx).",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({ state: "error", message: "Le fichier dépasse 5 Mo." });
      return;
    }
    setStatus({ state: "working" });
    const extension = mimeType === PDF ? "pdf" : "docx";
    const path = `${userId}/${kind === "cv" ? "cv" : "letter"}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await createClient()
      .storage.from("documents")
      .upload(path, file, { contentType: mimeType });
    if (uploaded.error) {
      setStatus({ state: "error", message: "L’envoi du fichier a échoué. Réessaie." });
      return;
    }
    const result = await registerDocument({
      kind,
      path,
      originalName: file.name,
      mimeType: mimeType as typeof PDF,
      size: file.size,
    });
    setStatus(result.ok ? { state: "done" } : { state: "error", message: result.error });
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={status.state === "working"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
        className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {status.state === "working"
          ? "Envoi et lecture du fichier…"
          : status.state === "done"
            ? "Fichier enregistré."
            : null}
      </p>
      {status.state === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function CurrentDocument({ document }: { document: DocumentSummary | null }) {
  if (!document) return null;
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        {document.pasted ? "Lettre collée" : (document.filename ?? "Document")} : aperçu du texte lu
      </summary>
      <p className="mt-2 whitespace-pre-line text-muted-foreground">{document.preview}</p>
    </details>
  );
}

function LetterText() {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLetterText, {});
  return (
    <ActionForm action={action} className="grid gap-2">
      <Label htmlFor="letter">Ou colle le texte de ta lettre</Label>
      <textarea
        id="letter"
        name="letter"
        className={textareaClassName + " min-h-48"}
        maxLength={8000}
        aria-invalid={Boolean(state.fieldErrors?.letter)}
        aria-describedby={state.fieldErrors?.letter ? "letter-error" : undefined}
      />
      <FieldError id="letter-error" message={state.fieldErrors?.letter} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.saved ? <p className="text-sm text-muted-foreground">Lettre enregistrée.</p> : null}
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Enregistrement…" : "Enregistrer ce texte"}
      </Button>
    </ActionForm>
  );
}

export function DocumentsStep({
  userId,
  cv,
  letter,
  showContinue = true,
  failed = false,
}: {
  userId: string;
  cv: DocumentSummary | null;
  letter: DocumentSummary | null;
  showContinue?: boolean;
  /** The last attempt to open the results did not go through. */
  failed?: boolean;
}) {
  const ready = cv !== null && letter !== null;
  return (
    <div className="grid gap-10">
      <section className="grid gap-3">
        <h2 className="font-medium">Ton CV</h2>
        <FieldHint>
          Au format PDF, 5 Mo au maximum. Il est stocké de façon privée et chiffrée.
        </FieldHint>
        <CurrentDocument document={cv} />
        <FileUpload
          userId={userId}
          kind="cv"
          accept=".pdf,application/pdf"
          allowed={[PDF]}
          label={cv ? "Remplacer le CV" : "Choisir ton CV"}
        />
      </section>
      <section className="grid gap-3">
        <h2 className="font-medium">Ta lettre de motivation de base</h2>
        <FieldHint>
          C’est elle qu’on adapte à chaque offre, en gardant ton style. PDF, Word ou texte collé.
          Astuce : écris [entreprise] et [poste] là où ils doivent apparaître, on les remplit pour
          chaque offre.
        </FieldHint>
        <CurrentDocument document={letter} />
        <FileUpload
          userId={userId}
          kind="cover_letter_base"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          allowed={[PDF, DOCX]}
          label={letter ? "Remplacer la lettre par un fichier" : "Choisir un fichier"}
        />
        <LetterText />
      </section>
      {failed && showContinue ? (
        <Alert variant="destructive">
          <AlertDescription>Ça n’a pas abouti. Réessaie dans un instant.</AlertDescription>
        </Alert>
      ) : null}
      {!showContinue ? null : ready ? (
        <form action={finishOnboarding}>
          <SubmitButton variant="shiny" size="lg" pendingLabel="On ouvre tes offres…">
            Voir mes offres
          </SubmitButton>
        </form>
      ) : (
        <div className="grid gap-3">
          <FieldHint>
            Avec ton CV, les correspondances sont plus précises. Avec ta lettre, on l’adapte à
            chaque entreprise.
          </FieldHint>
          <form action={skipDocuments}>
            <SubmitButton variant="outline" size="lg" pendingLabel="On ouvre tes offres…">
              Passer cette étape
            </SubmitButton>
          </form>
          <FieldHint>
            Tu pourras les ajouter plus tard depuis ton compte. Sans lettre de base, la lettre
            adaptée à chaque offre n’est pas disponible.
          </FieldHint>
        </div>
      )}
      {showContinue ? (
        <PendingOverlay
          title={
            <>
              On ouvre <em>tes offres</em>
            </>
          }
          messages={[
            "On met ta sélection à jour…",
            "On classe les offres par correspondance…",
            "On prépare ton espace…",
          ]}
        />
      ) : null}
    </div>
  );
}

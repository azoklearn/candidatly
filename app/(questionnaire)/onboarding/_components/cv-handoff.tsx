"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { takeStashedCv } from "@/lib/cv/handoff";

import { uploadDocument } from "./upload-document";

/**
 * The CV dropped on the landing page joins the account by itself (docs/QUESTIONS.md C100,
 * C111): it waited in the browser and is uploaded as soon as the account exists. `quiet`
 * shows nothing at all, for the result page where there is no file field to fall back on.
 */
export function CvHandoff({ userId, quiet = false }: { userId: string; quiet?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const file = await takeStashedCv();
      if (!file || cancelled) return;
      setStatus("working");
      const result = await uploadDocument(userId, "cv", file);
      if (cancelled) return;
      if (quiet) return;
      if (result.ok) router.refresh();
      else setStatus("error");
    })();
    return () => {
      cancelled = true;
    };
  }, [quiet, router, userId]);

  if (quiet || status === "idle") return null;
  if (status === "working") {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        On récupère le CV que tu as déposé…
      </p>
    );
  }
  return (
    <Alert>
      <AlertDescription>
        On n’a pas pu reprendre le CV déposé sur l’accueil. Choisis-le ci-dessous.
      </AlertDescription>
    </Alert>
  );
}

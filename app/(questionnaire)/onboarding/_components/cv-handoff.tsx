"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { takeStashedCv } from "@/lib/cv/handoff";

import { uploadDocument } from "./upload-document";

/**
 * The CV dropped on the landing page joins the account by itself (docs/QUESTIONS.md C100):
 * it waited in the browser, it is uploaded here, and the step no longer asks for it. A
 * failure is silent on purpose: the usual file field is right below.
 */
export function CvHandoff({ userId }: { userId: string }) {
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
      if (result.ok) router.refresh();
      else setStatus("error");
    })();
    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  if (status === "idle") return null;
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

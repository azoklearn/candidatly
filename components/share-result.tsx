"use client";

import { track } from "@vercel/analytics";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EVENTS } from "@/lib/analytics";

/**
 * Share of the result found for the student (docs/QUESTIONS.md C93): the native share
 * sheet on a phone, a copy to the clipboard elsewhere. The text only states the number
 * the search really returned.
 */
export function ShareResult({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.origin;
    track(EVENTS.resultShared);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Candidatly", text, url });
        return;
      } catch {
        // Sheet closed without sharing: fall back to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={share} className="q-card">
      {copied ? "Lien copié" : "Partager mon résultat"}
    </Button>
  );
}

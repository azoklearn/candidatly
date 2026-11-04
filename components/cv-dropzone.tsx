"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";

import { EVENTS } from "@/lib/analytics";

/**
 * The CV lands on the landing page (docs/QUESTIONS.md C95): it is read on the server, the
 * answers it suggests fill the questionnaire, and the file itself is not kept.
 */

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GENERIC_ERROR = "On n’a pas réussi à lire ce CV. Réessaie, ou réponds aux 5 questions.";

type State = { status: "idle" | "working" } | { status: "error"; message: string };

export function CvDropzone() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState<string | null>(null);

  async function send(file: File) {
    setName(file.name);
    setState({ status: "working" });
    track(EVENTS.cvScanned);
    try {
      const body = new FormData();
      body.append("cv", file);
      const response = await fetch("/api/scan-cv", { method: "POST", body });
      const data: { ok?: boolean; next?: string; error?: string } = await response.json();
      if (!response.ok || !data.ok || !data.next) {
        setState({ status: "error", message: data.error ?? GENERIC_ERROR });
        return;
      }
      router.push(data.next);
    } catch {
      setState({ status: "error", message: GENERIC_ERROR });
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void send(file);
  }

  const working = state.status === "working";

  return (
    <div
      className="cv-drop"
      data-dragging={dragging}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void send(file);
        }}
      />
      <button
        type="button"
        className="shiny-cta"
        disabled={working}
        onClick={() => input.current?.click()}
      >
        <span>{working ? "On lit ton CV…" : "Analyser mon CV"}</span>
      </button>
      <p className="cv-drop-hint">
        {working
          ? `${name ?? "Ton CV"} · quelques secondes`
          : "Glisse ton CV ici · PDF ou Word, 4 Mo maximum. Il n’est pas conservé."}
      </p>
      {state.status === "error" ? (
        <p className="cv-drop-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <Link className="text-link" href="/onboarding/1">
        Je n’ai pas mon CV ici <span>→</span>
      </Link>
    </div>
  );
}

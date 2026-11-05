"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import { EVENTS } from "@/lib/analytics";
import { canStashCv, clearStashedCv, stashCv } from "@/lib/cv/handoff";

/**
 * The CV lands on the landing page (docs/QUESTIONS.md C95 and C96): the whole window is a
 * drop target, the file is read on the server, and it is not kept. The zone says at every
 * moment what it is doing, because dropping a file is the one thing to do here.
 */

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 4 * 1024 * 1024;
const GENERIC_ERROR = "On n’a pas réussi à lire ce CV. Réessaie, ou réponds aux 5 questions.";

type State =
  | { status: "idle" }
  | { status: "reading"; name: string }
  | { status: "done"; name: string }
  | { status: "error"; message: string };

const hasFiles = (transfer: DataTransfer | null) =>
  Array.from(transfer?.types ?? []).includes("Files");

/** Refused before any upload, so the answer is instant. */
function localError(file: File): string | null {
  if (!/\.(pdf|docx)$/i.test(file.name)) return "Formats acceptés : PDF ou Word (.docx).";
  if (file.size > MAX_BYTES) return "Ton CV dépasse 4 Mo.";
  return null;
}

export function CvDropzone() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);

  const send = useCallback(
    async (file: File) => {
      const refused = localError(file);
      if (refused) {
        setState({ status: "error", message: refused });
        return;
      }
      setState({ status: "reading", name: file.name });
      track(EVENTS.cvScanned);
      // The file waits in this browser so the account does not ask for it again (C100).
      if (canStashCv(file)) await stashCv(file);
      else await clearStashedCv();
      try {
        const body = new FormData();
        body.append("cv", file);
        const response = await fetch("/api/scan-cv", { method: "POST", body });
        const data: { ok?: boolean; next?: string; error?: string } = await response.json();
        if (!response.ok || !data.ok || !data.next) {
          setState({ status: "error", message: data.error ?? GENERIC_ERROR });
          return;
        }
        setState({ status: "done", name: file.name });
        router.push(data.next);
      } catch {
        setState({ status: "error", message: GENERIC_ERROR });
      }
    },
    [router],
  );

  // A file dragged anywhere over the page is for us: the page says so and takes it.
  useEffect(() => {
    let depth = 0;
    const onEnter = (event: globalThis.DragEvent) => {
      if (!hasFiles(event.dataTransfer)) return;
      depth += 1;
      setDragging(true);
    };
    const onOver = (event: globalThis.DragEvent) => {
      if (hasFiles(event.dataTransfer)) event.preventDefault();
    };
    const onLeave = (event: globalThis.DragEvent) => {
      if (!hasFiles(event.dataTransfer)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: globalThis.DragEvent) => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      setOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void send(file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [send]);

  const busy = state.status === "reading" || state.status === "done";
  const pick = () => {
    if (!busy) input.current?.click();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick();
    }
  };
  const onZoneDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
  };

  return (
    <>
      <div
        className="cv-drop"
        data-state={state.status}
        data-over={over || dragging}
        onClick={pick}
        onKeyDown={onKeyDown}
        onDragOver={(event) => {
          if (!hasFiles(event.dataTransfer)) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onZoneDrop}
        role="button"
        tabIndex={0}
        aria-label="Déposer ou choisir ton CV"
        aria-busy={busy}
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void send(file);
          }}
        />

        <svg className="cv-dashes" aria-hidden focusable="false">
          <rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="27" />
        </svg>

        <span className="cv-sheet" aria-hidden>
          <span className="cv-sheet-line" />
          <span className="cv-sheet-line" />
          <span className="cv-sheet-line" />
          <b>{state.status === "done" ? "✓" : "+"}</b>
        </span>

        {state.status === "reading" || state.status === "done" ? (
          <>
            <strong className="cv-drop-title">
              {state.status === "done" ? "CV lu !" : "On lit ton CV…"}
            </strong>
            <span className="cv-drop-file">{state.name}</span>
            <span className="cv-drop-bar" aria-hidden />
          </>
        ) : (
          <>
            <strong className="cv-drop-title">
              <span className="cv-drop-drag">Glisse ton CV ici</span>
              <span className="cv-drop-tap">Choisis ton CV</span>
            </strong>
            <span className="cv-drop-hint">PDF ou Word, 4 Mo maximum. Il n’est pas stocké chez nous.</span>
            <button
              type="button"
              className="shiny-cta"
              onClick={(event) => {
                event.stopPropagation();
                pick();
              }}
            >
              <span>Analyser mon CV</span>
            </button>
          </>
        )}

        {state.status === "error" ? (
          <span className="cv-drop-error" role="alert">
            {state.message}
          </span>
        ) : null}

        <Link
          className="text-link cv-drop-skip"
          href="/onboarding/1"
          onClick={(event) => event.stopPropagation()}
        >
          Je n’ai pas mon CV ici <span aria-hidden>→</span>
        </Link>
      </div>

      {dragging ? (
        <div className="cv-overlay" aria-hidden>
          <div className="cv-overlay-frame">
            <span className="cv-overlay-title">Lâche ton CV</span>
            <span className="cv-overlay-hint">On s’occupe du reste</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

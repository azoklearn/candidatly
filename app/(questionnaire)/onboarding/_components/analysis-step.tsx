"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { finishOnboarding } from "../actions";

/**
 * The analysis screen (docs/QUESTIONS.md C93): the real work runs while the steps tick
 * by, so the wait reads as progress instead of a spinner. It never shows a figure it has
 * not measured; the count of offers comes on the next page.
 */

const LINES = [
  "On lit ton profil",
  "On scanne les offres publiées",
  "On repère les entreprises qui recrutent",
  "On calcule tes correspondances",
  "On prépare ta sélection",
] as const;

const LINE_MS = 850;
/** The animation always plays out, even when the server answers first. */
const MIN_MS = LINES.length * LINE_MS;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AnalysisStep({ failed }: { failed: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(
    failed ? "L’analyse n’a pas abouti. Réessaie." : null,
  );
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  const analyse = useCallback(async () => {
    const startedAt = Date.now();
    const result = await finishOnboarding();
    await wait(Math.max(0, MIN_MS - (Date.now() - startedAt)));
    if (!result.ok) {
      setError(result.error);
      running.current = false;
      return;
    }
    setDone(LINES.length);
    router.replace("/forfait");
  }, [router]);

  useEffect(() => {
    if (error) return;
    const timer = setInterval(
      () => setDone((current) => Math.min(current + 1, LINES.length)),
      LINE_MS,
    );
    return () => clearInterval(timer);
  }, [error, attempt]);

  useEffect(() => {
    if (running.current || error) return;
    running.current = true;
    void analyse();
  }, [analyse, error, attempt]);

  const percent = error ? 0 : Math.round((done / LINES.length) * 100);

  return (
    <div className="grid justify-items-center gap-8 py-4 text-center">
      <div
        className="analysis-ring"
        style={{ "--p": percent } as CSSProperties}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Analyse de ton profil"
      >
        <span className="text-2xl font-bold tracking-[-0.04em] tabular-nums">{percent} %</span>
      </div>

      <ul className="grid w-full max-w-sm gap-3 text-left">
        {LINES.map((line, index) => (
          <li
            key={line}
            className="analysis-line text-sm"
            data-state={index < done ? "done" : index === done ? "active" : "todo"}
          >
            <span className="analysis-check" aria-hidden>
              {index < done ? "✓" : ""}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {error ? (
        <div className="grid justify-items-center gap-3">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            type="button"
            variant="shiny"
            size="lg"
            onClick={() => {
              setError(null);
              setDone(0);
              running.current = false;
              setAttempt((value) => value + 1);
            }}
          >
            Réessayer
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          Ça prend quelques secondes, reste là.
        </p>
      )}
      <noscript>
        <p className="text-sm text-destructive">
          Active JavaScript pour terminer l’analyse de ton profil.
        </p>
      </noscript>
    </div>
  );
}

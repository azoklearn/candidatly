"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";

import { analyseQuestionnaire, type AnalysisResult } from "../actions";

/**
 * The analysis screen (docs/QUESTIONS.md C93 and C94): the real search runs while the
 * steps tick by, then the student sees what was found before being asked for an account.
 * Every figure comes from the search; nothing is made up while it waits.
 */

const LINES = [
  "On lit tes réponses",
  "On scanne les offres publiées",
  "On repère les entreprises qui recrutent",
  "On calcule tes correspondances",
  "On prépare ta sélection",
] as const;

const LINE_MS = 850;
/** The animation always plays out, even when the server answers first. */
const MIN_MS = LINES.length * LINE_MS;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AnalysisStep({ next, cta }: { next: string; cta: string }) {
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  const analyse = useCallback(async () => {
    const startedAt = Date.now();
    const answer = await analyseQuestionnaire();
    await wait(Math.max(0, MIN_MS - (Date.now() - startedAt)));
    setDone(LINES.length);
    setResult(answer);
    running.current = false;
  }, []);

  useEffect(() => {
    if (result) return;
    const timer = setInterval(
      () => setDone((current) => Math.min(current + 1, LINES.length)),
      LINE_MS,
    );
    return () => clearInterval(timer);
  }, [result, attempt]);

  useEffect(() => {
    if (running.current || result) return;
    running.current = true;
    void analyse();
  }, [analyse, result, attempt]);

  if (result?.ok) {
    const { offers, companies } = result.counts;
    // No figure on this screen (owner, 29 September 2026): the wording only says what was
    // really found, and stays true when the search came back empty.
    const found = offers > 0 || companies > 0;
    const headline = found ? "prête" : "lancée";
    const message =
      offers > 0
        ? "On a trouvé des offres qui pourraient t’intéresser !"
        : companies > 0
          ? "On a trouvé des entreprises qui recrutent près de chez toi !"
          : "De nouvelles offres sont publiées chaque jour.";
    const extra =
      offers > 0 && companies > 0 ? "Et des entreprises qui recrutent près de chez toi." : null;
    return (
      <div className="q-in grid justify-items-center gap-6 py-2 text-center">
        <h1 className="page-title">
          Ta {found ? "sélection" : "recherche"} est <em>{headline}</em>
        </h1>
        <div className="analysis-ring" style={{ "--p": 100 } as CSSProperties} aria-hidden>
          <span className="text-3xl font-bold text-brand">✓</span>
        </div>
        <div className="grid gap-2">
          <p className="section-title">{message}</p>
          {extra ? <p className="text-sm text-muted-foreground">{extra}</p> : null}
        </div>
        <Link
          href={next}
          className={`${buttonVariants({ variant: "shiny", size: "lg" })} q-card h-12 w-full max-w-sm px-7 text-base`}
        >
          {cta} <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  const percent = result ? 0 : Math.round((done / LINES.length) * 100);

  return (
    <div className="grid justify-items-center gap-8 py-2 text-center">
      <h1 className="page-title">
        On analyse <em>ton profil</em>
      </h1>
      {result && !result.ok ? (
        <div className="grid justify-items-center gap-3">
          <Alert variant="destructive">
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
          <Button
            type="button"
            variant="shiny"
            size="lg"
            onClick={() => {
              setResult(null);
              setDone(0);
              running.current = false;
              setAttempt((value) => value + 1);
            }}
          >
            Réessayer
          </Button>
        </div>
      ) : (
        <>
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
          <p className="text-sm text-muted-foreground" role="status">
            Ça prend quelques secondes, reste là.
          </p>
          <noscript>
            <p className="text-sm text-destructive">
              Active JavaScript pour lancer l’analyse de ton profil.
            </p>
          </noscript>
        </>
      )}
    </div>
  );
}

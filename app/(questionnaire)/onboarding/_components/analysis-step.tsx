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
 *
 * The progress follows the clock rather than the five steps, so the ring fills continuously
 * instead of jumping by a fifth; when the server takes longer than the animation it holds
 * just short of the end, and the ring is sealed to 100 % only once the answer is really in.
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
/** Progress refresh: often enough to read as a movement, rare enough to stay cheap. */
const TICK_MS = 70;
/** While the server has not answered, the ring stops here: the search is not over yet. */
const WAITING_CEILING = 94;
/** The ring finishes filling before the result takes the screen. */
const SEAL_MS = 620;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Phase = "running" | "sealing" | "done";

export function AnalysisStep({ next, cta }: { next: string; cta: string }) {
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState<Phase>("running");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  const analyse = useCallback(async () => {
    const startedAt = Date.now();
    const answer = await analyseQuestionnaire();
    await wait(Math.max(0, MIN_MS - (Date.now() - startedAt)));
    setResult(answer);
    running.current = false;
    if (!answer.ok) {
      setPhase("done");
      return;
    }
    // The ring reaches the end, then the result arrives: no abrupt swap mid-animation.
    setPercent(100);
    setPhase("sealing");
    await wait(SEAL_MS);
    setPhase("done");
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const share = ((Date.now() - startedAt) / MIN_MS) * 100;
      setPercent(Math.min(WAITING_CEILING, Math.round(share)));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [phase, attempt]);

  useEffect(() => {
    if (running.current || phase !== "running") return;
    running.current = true;
    void analyse();
  }, [analyse, phase, attempt]);

  const retry = () => {
    setResult(null);
    setPercent(0);
    running.current = false;
    setPhase("running");
    setAttempt((value) => value + 1);
  };

  const failed = phase === "done" && result !== null && !result.ok;
  const succeeded = phase === "done" && result?.ok === true;
  const lines = Math.min(LINES.length, Math.floor((percent / 100) * LINES.length));

  let found = false;
  let message = "";
  let extra: string | null = null;
  if (result?.ok) {
    const { offers, companies } = result.counts;
    // No figure on this screen (owner, 29 September 2026): the wording only says what was
    // really found, and stays true when the search came back empty.
    if (result.companiesOnly) {
      // Internships and student jobs: companies of the student's trades nearby (C106).
      found = companies > 0;
      message = found
        ? "On a trouvé des entreprises de ton domaine près de chez toi !"
        : "Élargis ton rayon pour voir plus d’entreprises.";
    } else {
      found = offers > 0 || companies > 0;
      message =
        offers > 0
          ? "On a trouvé des offres qui pourraient t’intéresser !"
          : companies > 0
            ? "On a trouvé des entreprises qui recrutent près de chez toi !"
            : "De nouvelles offres sont publiées chaque jour.";
      extra =
        offers > 0 && companies > 0 ? "Et des entreprises qui recrutent près de chez toi." : null;
    }
  }

  return (
    <div className="grid justify-items-center gap-7 py-2 text-center">
      <h1 className="page-title">
        {succeeded ? (
          <span className="swap">
            Ta {found ? "sélection" : "recherche"} est <em>{found ? "prête" : "lancée"}</em>
          </span>
        ) : (
          <>
            On analyse <em>ton profil</em>
          </>
        )}
      </h1>

      {/* The ring stays in place from the first percent to the result: one single object. */}
      {failed ? null : (
        <div
          className="analysis-ring"
          data-seal={phase === "sealing" || succeeded ? "true" : undefined}
          style={{ "--p": succeeded ? 100 : percent } as CSSProperties}
          role="progressbar"
          aria-valuenow={succeeded ? 100 : percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analyse de ton profil"
        >
          {succeeded ? (
            <span className="swap text-3xl font-bold text-brand" aria-hidden>
              ✓
            </span>
          ) : (
            <span className="text-2xl font-bold tracking-[-0.04em] tabular-nums">{percent} %</span>
          )}
        </div>
      )}

      {/* One zone below the ring, so its content can change without moving the page. */}
      <div className="grid w-full max-w-sm content-start justify-items-center gap-5 min-h-56">
        {failed && result && !result.ok ? (
          <div className="swap grid justify-items-center gap-3">
            <Alert variant="destructive">
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
            <Button type="button" variant="shiny" size="lg" onClick={retry}>
              Réessayer
            </Button>
          </div>
        ) : succeeded ? (
          <div className="swap grid justify-items-center gap-5">
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
        ) : (
          <>
            <ul className="grid w-full gap-3 text-left">
              {LINES.map((line, index) => (
                <li
                  key={line}
                  className="analysis-line text-sm"
                  data-state={index < lines ? "done" : index === lines ? "active" : "todo"}
                >
                  <span className="analysis-check" aria-hidden>
                    {index < lines ? "✓" : ""}
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
    </div>
  );
}

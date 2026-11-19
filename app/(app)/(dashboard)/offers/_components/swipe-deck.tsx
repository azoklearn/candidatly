"use client";

import { Check, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

import { swipeMatch } from "../actions";

/**
 * The offers one at a time (docs/QUESTIONS.md C120): slide right to keep, left to set
 * aside. The same two decisions as the list, made for the thumb. Two buttons and the arrow
 * keys do the same thing, and the last decision can be undone.
 */

export type SwipeCard = {
  matchId: string;
  offerId: string;
  title: string;
  company: string | null;
  details: string;
  contract: string;
  score: number;
  fits: string[];
  gaps: string[];
};

type Decision = "saved" | "dismissed";

/** How far the card must travel before the decision is taken. */
const THRESHOLD_PX = 96;
const LEAVE_MS = 240;

export function SwipeDeck({ cards }: { cards: SwipeCard[] }) {
  const [decided, setDecided] = useState<{ matchId: string; decision: Decision }[]>([]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Decision | null>(null);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);

  const gone = new Set(decided.map((item) => item.matchId));
  const remaining = cards.filter((card) => !gone.has(card.matchId));
  const current = remaining[0];
  const next = remaining[1];

  const decide = useCallback(
    (decision: Decision) => {
      if (!current || leaving) return;
      const matchId = current.matchId;
      setLeaving(decision);
      setFailed(false);
      void swipeMatch(matchId, decision).then((result) => {
        if (!result.ok) {
          // Not saved: the card comes back rather than vanishing for nothing.
          setDecided((items) => items.filter((item) => item.matchId !== matchId));
          setFailed(true);
        }
      });
      window.setTimeout(() => {
        setDecided((items) => [...items, { matchId, decision }]);
        setLeaving(null);
        setDx(0);
      }, LEAVE_MS);
    },
    [current, leaving],
  );

  const undo = useCallback(() => {
    const last = decided.at(-1);
    if (!last || leaving) return;
    setDecided((items) => items.slice(0, -1));
    void swipeMatch(last.matchId, "new");
  }, [decided, leaving]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (event.key === "ArrowRight") decide("saved");
      if (event.key === "ArrowLeft") decide("dismissed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (leaving || (event.target as HTMLElement).closest("a")) return;
    start.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current !== null) setDx(event.clientX - start.current);
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    start.current = null;
    setDragging(false);
    if (dx > THRESHOLD_PX) decide("saved");
    else if (dx < -THRESHOLD_PX) decide("dismissed");
    else setDx(0);
  };

  if (!current) {
    const kept = decided.filter((item) => item.decision === "saved").length;
    return (
      <div className="panel-tint fade-up grid justify-items-start gap-3 rounded-3xl border p-6">
        <p className="section-title">
          Tout est <em>trié</em>
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {cards.length === 0
            ? "Aucune nouvelle offre à trier pour l’instant. Les suivantes arriveront ici."
            : `${kept} ${kept > 1 ? "offres gardées" : "offre gardée"} sur ${decided.length}. Elles vous attendent dans la liste.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/offers?view=saved"
            className="btn-ink rounded-full px-4 py-2 text-sm font-semibold"
          >
            Voir les offres gardées
          </Link>
          {decided.length > 0 ? (
            <button
              type="button"
              onClick={undo}
              className="btn-glass rounded-full px-4 py-2 text-sm font-semibold"
            >
              Annuler la dernière
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const offset = leaving ? (leaving === "saved" ? 520 : -520) : dx;
  const keepHint = Math.min(1, Math.max(0, offset / THRESHOLD_PX));
  const dropHint = Math.min(1, Math.max(0, -offset / THRESHOLD_PX));

  return (
    <div className="grid gap-5">
      <div className="swipe-stage">
        {next ? (
          <div className="swipe-card swipe-card-under panel border bg-card" aria-hidden>
            <p className="font-heading text-xl font-semibold tracking-[-0.03em]">{next.title}</p>
          </div>
        ) : null}
        <div
          key={current.matchId}
          className="swipe-card panel border bg-card"
          data-dragging={dragging ? "true" : undefined}
          style={{
            transform: `translate3d(${offset}px, 0, 0) rotate(${offset / 22}deg)`,
            opacity: leaving ? 0 : 1,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="swipe-stamp swipe-stamp-keep" style={{ opacity: keepHint }} aria-hidden>
            Garder
          </span>
          <span className="swipe-stamp swipe-stamp-drop" style={{ opacity: dropHint }} aria-hidden>
            Écarter
          </span>
          <div className="flex items-start justify-between gap-3">
            <span className="match-pill">✦ {Math.round(current.score)} %</span>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {remaining.length} à trier
            </span>
          </div>
          <div className="grid gap-1.5">
            <h2 className="font-heading text-[1.6rem] leading-[1.05] font-semibold tracking-[-0.04em]">
              {current.title}
            </h2>
            {current.company ? <p className="font-semibold">{current.company}</p> : null}
            <p className="text-sm text-muted-foreground">{current.details}</p>
          </div>
          <span className="w-fit rounded-full bg-foreground/8 px-3 py-1 text-xs font-semibold">
            {current.contract}
          </span>
          <div className="grid gap-2 border-t border-foreground/10 pt-3 text-sm">
            {current.fits.length > 0 ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">Ce qui colle</span>
                {current.fits.map((item) => (
                  <span key={item} className="swipe-chip swipe-chip-fit">
                    {item}
                  </span>
                ))}
              </p>
            ) : null}
            {current.gaps.length > 0 ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">À vérifier</span>
                {current.gaps.map((item) => (
                  <span key={item} className="swipe-chip">
                    {item}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <Link
            href={`/offers/${current.offerId}`}
            className="mt-auto w-fit text-sm font-semibold text-brand underline-offset-4 hover:underline"
          >
            Voir le détail <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      {failed ? (
        <p role="alert" className="text-center text-sm text-destructive">
          Ce choix n’a pas pu être enregistré. Réessayez.
        </p>
      ) : null}

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => decide("dismissed")}
          className="swipe-button btn-glass"
          aria-label="Écarter cette offre"
        >
          <X aria-hidden />
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={decided.length === 0}
          className="swipe-button swipe-button-small btn-glass disabled:opacity-40"
          aria-label="Annuler le dernier choix"
        >
          <Undo2 aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => decide("saved")}
          className="swipe-button shiny-cta"
          aria-label="Garder cette offre"
        >
          <Check aria-hidden />
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Glissez à droite pour garder, à gauche pour écarter.
      </p>
    </div>
  );
}

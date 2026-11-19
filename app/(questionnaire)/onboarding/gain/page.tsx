import { Check, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { buttonVariants } from "@/components/ui/button";
import { currentUserId } from "@/lib/auth/session";
import { companiesOnly } from "@/lib/offers/contract-mode";
import { draftSnapshot } from "@/lib/onboarding/draft";
import { readDraft } from "@/lib/onboarding/draft-cookie";
import { firstIncompleteStep, VISITOR_LAST_STEP } from "@/lib/onboarding/state";
import { createClient } from "@/lib/supabase/server";

import { loadOnboarding } from "../data";

export const metadata: Metadata = { title: "Ce qu’on fait à ta place" };

/** The question that follows this pause, and the one that leads to it. */
const NEXT_STEP = 9;
const PREVIOUS_STEP = 8;

type Row = { before: string; after: string };

/** Only what the product really does today: nothing marked "Bientôt" appears here. */
const OFFER_ROWS: Row[] = [
  {
    before: "Chercher sur plusieurs sites, tous les jours",
    after: "Les offres publiées, déjà triées pour ton profil",
  },
  {
    before: "Lire chaque annonce pour voir si ça colle",
    after: "Un score de correspondance sur chaque offre",
  },
  {
    before: "Réécrire ta lettre pour chaque entreprise",
    after: "Ta lettre adaptée en quelques secondes, chaque changement montré",
  },
  {
    before: "Te souvenir de qui relancer, et quand",
    after: "Le suivi de tes réponses, et la relance conseillée à 5 jours",
  },
];
const COMPANY_ROWS: Row[] = [
  {
    before: "Chercher quelles entreprises contacter",
    after: "Les entreprises de ton domaine près de chez toi, les plus proches d’abord",
  },
  {
    before: "Fouiller pour trouver un contact",
    after: "Leur fiche, et leur téléphone quand on le connaît",
  },
];

const INTRO: Record<string, string> = {
  low: "Si tu postules peu, c’est normal : chaque candidature prend un temps fou.",
  medium: "Tu postules déjà régulièrement. Voilà le temps qu’on peut te rendre.",
  high: "Tu postules beaucoup. Voilà ce qu’on enlève de tes soirées.",
};

/**
 * A pause between two questions (docs/QUESTIONS.md C118): what the student does by hand
 * today, and what JobGPT does in their place. No figure, no promise of a result.
 */
export default async function GainPage() {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  let rhythm: string | null;
  let contract: string | null | undefined;
  if (userId) {
    const data = await loadOnboarding(supabase, userId);
    if (data.profile.onboarding_completed) redirect("/offers");
    const step = firstIncompleteStep(data.snapshot);
    if (step <= PREVIOUS_STEP) redirect(`/onboarding/${step}`);
    rhythm = data.profile.weekly_applications;
    contract = data.profile.target_contract;
  } else {
    const draft = await readDraft();
    const step = firstIncompleteStep(draftSnapshot(draft));
    if (step <= PREVIOUS_STEP) redirect(`/onboarding/${step}`);
    rhythm = draft.weekly_applications ?? null;
    contract = draft.target_contract;
  }
  const rows = companiesOnly(contract) ? COMPANY_ROWS : OFFER_ROWS;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-24 sm:py-10">
      <header className="mb-7 grid gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[0.8125rem] font-semibold text-muted-foreground">
            Avant la dernière question
          </span>
          <Link
            href={`/onboarding/${PREVIOUS_STEP}`}
            className="btn-glass rounded-full px-3 py-1 text-[0.8125rem] font-semibold text-muted-foreground hover:text-foreground"
          >
            <span aria-hidden>← </span>Retour
          </Link>
        </div>
        <div className="q-segments" aria-hidden>
          {Array.from({ length: VISITOR_LAST_STEP }, (_, index) => (
            <span key={index} data-state={index < PREVIOUS_STEP ? "done" : "todo"} />
          ))}
        </div>
        <div className="q-in grid gap-2">
          <h1 className="page-title">
            Postuler à la main, c’est surtout du <em>temps perdu</em>
          </h1>
          <p className="text-[0.9375rem] text-muted-foreground">
            {(rhythm && INTRO[rhythm]) ?? "Voilà ce que JobGPT fait à ta place."}
          </p>
        </div>
      </header>

      <ul className="grid gap-3">
        {rows.map((row, index) => (
          <li
            key={row.before}
            style={{ "--i": index } as CSSProperties}
            className="q-in panel grid gap-2.5 rounded-[1.5rem] border bg-card p-4"
          >
            <p className="flex items-start gap-3 text-sm text-muted-foreground">
              <span
                aria-hidden
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-foreground/8"
              >
                <X className="size-3" strokeWidth={3} />
              </span>
              <span>
                <span className="sr-only">À la main : </span>
                <s className="decoration-foreground/25">{row.before}</s>
              </span>
            </p>
            <p className="flex items-start gap-3 font-heading text-[1.0625rem] leading-snug font-semibold tracking-[-0.02em]">
              <span
                aria-hidden
                className="plan-badge mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
              >
                <Check className="size-3" strokeWidth={3.5} />
              </span>
              <span>
                <span className="sr-only">Avec JobGPT : </span>
                {row.after}
              </span>
            </p>
          </li>
        ))}
      </ul>

      <div className="glass-bar sticky bottom-3 z-20 mt-6 p-1.5 sm:static sm:w-fit sm:border-0 sm:bg-none sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-filter-none">
        <Link
          href={`/onboarding/${NEXT_STEP}`}
          className={`${buttonVariants({ variant: "shiny", size: "lg" })} h-12 w-full px-8 text-base sm:w-auto`}
        >
          Continuer <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentUserId } from "@/lib/auth/session";
import { draftSnapshot } from "@/lib/onboarding/draft";
import { readDraft } from "@/lib/onboarding/draft-cookie";
import {
  ACCOUNT_STEP_PATH,
  firstIncompleteStep,
  LAST_STEP,
  VISITOR_LAST_STEP,
} from "@/lib/onboarding/state";
import { createClient } from "@/lib/supabase/server";

import { AnalysisStep } from "../_components/analysis-step";
import { loadOnboarding } from "../data";

export const metadata: Metadata = { title: "Analyse" };

/**
 * Between the questions and the account (docs/QUESTIONS.md C94): the search really runs,
 * the student sees what it found, then creates the account to open it.
 */
export default async function AnalysisPage() {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  let next = ACCOUNT_STEP_PATH;
  let cta = "Voir les offres";

  if (userId) {
    const data = await loadOnboarding(supabase, userId);
    if (data.profile.onboarding_completed) redirect("/offers");
    const step = firstIncompleteStep(data.snapshot);
    if (step <= VISITOR_LAST_STEP) redirect(`/onboarding/${step}`);
    next = `/onboarding/${Math.min(step, LAST_STEP)}`;
    cta = "Continuer";
  } else {
    const pending = firstIncompleteStep(draftSnapshot(await readDraft()));
    if (pending <= VISITOR_LAST_STEP) redirect(`/onboarding/${pending}`);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <header className="mb-8 grid gap-4">
        <span className="eyebrow">Résultat</span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10" aria-hidden>
          <div className="h-full w-[71%] rounded-full bg-linear-to-r from-brand-soft to-brand" />
        </div>
      </header>
      <AnalysisStep next={next} cta={cta} />
    </main>
  );
}

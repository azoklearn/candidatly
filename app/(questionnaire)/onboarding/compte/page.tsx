import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signUp } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/app/(auth)/credentials-form";
import { GoogleButton, OrSeparator } from "@/app/(auth)/google-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isGoogleSignInEnabled } from "@/lib/auth/providers";
import { currentUserId } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { draftSnapshot } from "@/lib/onboarding/draft";
import { readDraft } from "@/lib/onboarding/draft-cookie";
import {
  ACCOUNT_STEP,
  ANALYSIS_PATH,
  DOCUMENTS_STEP,
  firstIncompleteStep,
  LAST_STEP,
  VISITOR_LAST_STEP,
} from "@/lib/onboarding/state";
import { createClient } from "@/lib/supabase/server";

import { stepLabel } from "../_components/step-header";

import { loadOnboarding } from "../data";

export const metadata: Metadata = { title: "Créer mon compte" };

const NEXT_STEP = `/onboarding/${DOCUMENTS_STEP}`;
const STEP_NUMBER = ACCOUNT_STEP;

/**
 * The account is asked once the questions are answered (docs/QUESTIONS.md C91): the
 * answers are waiting in a cookie and land on the profile as soon as it exists.
 */
export default async function AccountStepPage() {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (userId) {
    const data = await loadOnboarding(supabase, userId);
    redirect(
      data.profile.onboarding_completed
        ? "/offers"
        : `/onboarding/${firstIncompleteStep(data.snapshot)}`,
    );
  }
  const draft = await readDraft();
  const pending = firstIncompleteStep(draftSnapshot(draft));
  if (pending <= VISITOR_LAST_STEP) redirect(`/onboarding/${pending}`);
  // What the analysis found, so the reason to sign up stays on screen (C94).
  const found = draft.found_offers ?? 0;
  const google = await isGoogleSignInEnabled();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <header className="fade-up mb-8 grid gap-4">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{stepLabel(STEP_NUMBER)}</span>
          <Link
            href={ANALYSIS_PATH}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <span aria-hidden>← </span>Retour
          </Link>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10" aria-hidden>
          <div
            className="h-full rounded-full bg-linear-to-r from-brand-soft to-brand transition-[width] duration-500"
            style={{ width: `${(STEP_NUMBER / LAST_STEP) * 100}%` }}
          />
        </div>
        <h1 className="page-title">
          Crée ton <em>compte</em>
        </h1>
        <p className="text-muted-foreground">
          {found > 0
            ? `${found} ${found > 1 ? "offres t’attendent" : "offre t’attend"} : ton compte sert à les retrouver, avec tes lettres et le suivi de tes candidatures.`
            : "Tes réponses sont gardées. Ton compte te sert à retrouver tes offres, tes lettres et le suivi de tes candidatures."}
        </p>
      </header>
      <div className="grid gap-4">
        {!isSupabaseConfigured() ? (
          <Alert variant="destructive">
            <AlertDescription>
              La connexion est indisponible : ce site n’est pas encore relié à sa base de données.
            </AlertDescription>
          </Alert>
        ) : null}
        {google ? (
          <>
            <GoogleButton next={NEXT_STEP} />
            <OrSeparator />
          </>
        ) : null}
        <CredentialsForm action={signUp} mode="sign-up" next={NEXT_STEP}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="first_name">Prénom</Label>
              <Input id="first_name" name="first_name" autoComplete="given-name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name">Nom</Label>
              <Input id="last_name" name="last_name" autoComplete="family-name" required />
            </div>
          </div>
        </CredentialsForm>
        <p className="text-sm text-muted-foreground">
          Tu as déjà un compte ?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(NEXT_STEP)}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Se connecter
          </Link>
          . Tes réponses sont reprises.
        </p>
      </div>
    </main>
  );
}

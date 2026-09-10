import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/coming-soon";

/** Onboarding steps from docs/BRIEF.md section 5.1. Built in phase 2. */
const STEPS = [
  "Création du compte",
  "Votre profil",
  "Domaine recherché",
  "Localisation",
  "CV et lettre de motivation",
  "Vos crédits offerts",
] as const;

export const metadata: Metadata = { title: "Inscription" };

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  const index = Number(step);
  const title = Number.isInteger(index) ? STEPS[index - 1] : undefined;
  if (!title) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="mb-2 text-sm text-muted-foreground">
        Étape {index} sur {STEPS.length}
      </p>
      <ComingSoon
        title={title}
        description="Le parcours d’inscription arrive dans la prochaine version."
      />
    </main>
  );
}

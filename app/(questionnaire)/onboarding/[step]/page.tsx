import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { currentUserId } from "@/lib/auth/session";
import { draftProfileValues, draftSnapshot, type OnboardingDraft } from "@/lib/onboarding/draft";
import { readDraft } from "@/lib/onboarding/draft-cookie";
import {
  ACCOUNT_STEP_PATH,
  firstIncompleteStep,
  isStepAccessible,
  parseStep,
  VISITOR_LAST_STEP,
} from "@/lib/onboarding/state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { BonusStep } from "../_components/bonus-step";
import { DocumentsStep } from "../_components/documents-step";
import { LocationStep } from "../_components/location-step";
import { ProfileForm } from "../_components/profile-form";
import { RomeStep } from "../_components/rome-step";
import { StepHeader } from "../_components/step-header";
import { WelcomeStep } from "../_components/welcome-step";
import { loadOnboarding } from "../data";

export const metadata: Metadata = { title: "Inscription" };

const DEFAULT_RADIUS_KM = 30;

/** The chosen jobs are shown with their official label, which visitors may read too. */
async function romeLabels(codes: string[]): Promise<{ code: string; label: string }[]> {
  if (codes.length === 0) return [];
  const { data } = await createAdminClient()
    .from("rome_codes")
    .select("code, label")
    .in("code", codes);
  return data ?? [];
}

function Shell({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <StepHeader step={step} />
      {children}
    </main>
  );
}

/** A visitor answers the first steps; the answers wait in a cookie (docs/QUESTIONS.md C91). */
async function VisitorStep({ step, draft }: { step: number; draft: OnboardingDraft }) {
  if (step > VISITOR_LAST_STEP) redirect(ACCOUNT_STEP_PATH);
  const snapshot = draftSnapshot(draft);
  if (!isStepAccessible(step, snapshot)) redirect(`/onboarding/${firstIncompleteStep(snapshot)}`);
  const selected = step === 3 ? await romeLabels(draft.rome_codes ?? []) : [];

  return (
    <Shell step={step}>
      {step === 1 ? <WelcomeStep firstName={draft.first_name ?? null} visitor /> : null}
      {step === 2 ? <ProfileForm profile={draftProfileValues(draft)} /> : null}
      {step === 3 ? (
        <RomeStep initialText={draft.domain_free_text ?? ""} selected={selected} />
      ) : null}
      {step === 4 ? (
        <LocationStep
          initialLabel={draft.location_label ?? null}
          initialCitycode={draft.insee_code ?? null}
          initialRadius={draft.search_radius_km ?? DEFAULT_RADIUS_KM}
        />
      ) : null}
    </Shell>
  );
}

export default async function OnboardingStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const step = parseStep((await params).step);
  if (step === null) notFound();
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return <VisitorStep step={step} draft={await readDraft()} />;

  const data = await loadOnboarding(supabase, userId);
  if (data.profile.onboarding_completed) redirect("/offers");
  if (!isStepAccessible(step, data.snapshot))
    redirect(`/onboarding/${firstIncompleteStep(data.snapshot)}`);
  const selected = step === 3 ? await romeLabels(data.profile.rome_codes) : [];

  return (
    <Shell step={step}>
      {step === 1 ? <WelcomeStep firstName={data.profile.first_name} /> : null}
      {step === 2 ? <ProfileForm profile={data.profile} /> : null}
      {step === 3 ? (
        <RomeStep initialText={data.profile.domain_free_text ?? ""} selected={selected} />
      ) : null}
      {step === 4 ? (
        <LocationStep
          initialLabel={data.profile.location_label}
          initialCitycode={data.profile.insee_code}
          initialRadius={data.profile.search_radius_km}
        />
      ) : null}
      {step === 5 ? <DocumentsStep userId={userId} cv={data.cv} letter={data.letter} /> : null}
      {step === 6 ? <BonusStep failed={Boolean((await searchParams).error)} /> : null}
    </Shell>
  );
}

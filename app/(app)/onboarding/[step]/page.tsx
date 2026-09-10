import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth/session";
import { firstIncompleteStep, isStepAccessible, parseStep } from "@/lib/onboarding/state";
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
  const userId = await requireUserId(supabase);
  const data = await loadOnboarding(supabase, userId);
  if (data.profile.onboarding_completed) redirect("/offers");
  if (!isStepAccessible(step, data.snapshot))
    redirect(`/onboarding/${firstIncompleteStep(data.snapshot)}`);

  let selected: { code: string; label: string }[] = [];
  if (step === 3 && data.profile.rome_codes.length > 0) {
    const codes = await supabase
      .from("rome_codes")
      .select("code, label")
      .in("code", data.profile.rome_codes);
    selected = codes.data ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <StepHeader step={step} />
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
    </main>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUserId } from "@/lib/auth/session";
import { DEFAULT_RADIUS_KM } from "@/lib/onboarding/cities";
import { findDomainByLabel, type JobDomain } from "@/lib/onboarding/domains";
import { draftSnapshot, type OnboardingDraft } from "@/lib/onboarding/draft";
import { readDraft } from "@/lib/onboarding/draft-cookie";
import {
  ACCOUNT_STEP,
  ACCOUNT_STEP_PATH,
  firstIncompleteStep,
  isStepAccessible,
  parseStep,
  VISITOR_LAST_STEP,
} from "@/lib/onboarding/state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { AnalysisStep } from "../_components/analysis-step";
import { ContractStep } from "../_components/contract-step";
import { CityStep } from "../_components/city-step";
import { DocumentsStep } from "../_components/documents-step";
import { DomainStep } from "../_components/domain-step";
import { IdentityStep } from "../_components/identity-step";
import { JobStep, type JobOption } from "../_components/job-step";
import { LevelStep } from "../_components/level-step";
import { StepHeader } from "../_components/step-header";
import { loadOnboarding } from "../data";

export const metadata: Metadata = { title: "Questionnaire" };

/**
 * The jobs of a domain, with their official ROME labels. Visitors have no session, so the
 * nomenclature is read with the service key (docs/QUESTIONS.md C91).
 */
async function jobsOfDomain(domain: JobDomain): Promise<JobOption[]> {
  const { data } = await createAdminClient()
    .from("rome_codes")
    .select("code, label")
    .in("code", [...domain.codes])
    .eq("is_active", true);
  const labels = new Map((data ?? []).map((row) => [row.code, row.label]));
  return domain.codes.flatMap((code) => {
    const label = labels.get(code);
    return label ? [{ code, label }] : [];
  });
}

function Shell({ step, children }: { step: number; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <StepHeader step={step} />
      {children}
    </main>
  );
}

/** A visitor answers the five questions; the answers wait in a cookie (C91). */
async function VisitorStep({ step, draft }: { step: number; draft: OnboardingDraft }) {
  if (step > VISITOR_LAST_STEP) redirect(ACCOUNT_STEP_PATH);
  const snapshot = draftSnapshot(draft);
  if (!isStepAccessible(step, snapshot)) redirect(`/onboarding/${firstIncompleteStep(snapshot)}`);
  const domain = findDomainByLabel(draft.domain_free_text);
  if (step === 3 && !domain) redirect("/onboarding/2");

  return (
    <Shell step={step}>
      {step === 1 ? (
        <ContractStep chosen={draft.contract_chosen_at ? (draft.target_contract ?? null) : null} />
      ) : null}
      {step === 2 ? <DomainStep chosen={domain?.id ?? null} /> : null}
      {step === 3 && domain ? (
        <JobStep
          domainLabel={domain.label}
          jobs={await jobsOfDomain(domain)}
          selected={draft.rome_codes ?? []}
        />
      ) : null}
      {step === 4 ? <LevelStep chosen={draft.diploma_level ?? null} /> : null}
      {step === 5 ? (
        <CityStep
          initialLabel={draft.location_label ?? null}
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
  const domain = findDomainByLabel(data.profile.domain_free_text);
  if (step === 3 && !domain) redirect("/onboarding/2");

  return (
    <Shell step={step}>
      {step === 1 ? (
        <ContractStep
          chosen={data.profile.contract_chosen_at ? data.profile.target_contract : null}
        />
      ) : null}
      {step === 2 ? <DomainStep chosen={domain?.id ?? null} /> : null}
      {step === 3 && domain ? (
        <JobStep
          domainLabel={domain.label}
          jobs={await jobsOfDomain(domain)}
          selected={data.profile.rome_codes}
        />
      ) : null}
      {step === 4 ? <LevelStep chosen={data.profile.diploma_level} /> : null}
      {step === 5 ? (
        <CityStep
          initialLabel={data.profile.location_label}
          initialRadius={data.profile.search_radius_km}
        />
      ) : null}
      {step === ACCOUNT_STEP ? (
        <IdentityStep firstName={data.profile.first_name} lastName={data.profile.last_name} />
      ) : null}
      {step === 7 ? <DocumentsStep userId={userId} cv={data.cv} letter={data.letter} /> : null}
      {step === 8 ? <AnalysisStep failed={Boolean((await searchParams).error)} /> : null}
    </Shell>
  );
}

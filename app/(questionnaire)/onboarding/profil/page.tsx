import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentUserId } from "@/lib/auth/session";
import { DEFAULT_RADIUS_KM } from "@/lib/onboarding/cities";
import { findDomainByLabel, JOB_DOMAINS } from "@/lib/onboarding/domains";
import { readDraft } from "@/lib/onboarding/draft-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { ScanNote } from "../_components/scan-note";
import { ScanRecap, type JobOption } from "../_components/scan-recap";
import { loadOnboarding } from "../data";

export const metadata: Metadata = { title: "On a lu ton CV" };

/**
 * The screen that follows a CV dropped on the landing page (docs/QUESTIONS.md C100): the
 * five answers of the questionnaire at once, already filled with what the scan read. A
 * visitor who arrives without a CV never sees it and answers the questions one by one.
 */

/** The jobs of every domain, with their official labels: the student switches domain here. */
async function loadJobs(signedIn: boolean): Promise<Record<string, JobOption[]>> {
  const supabase = signedIn ? await createClient() : createAdminClient();
  const codes = JOB_DOMAINS.flatMap((domain) => [...domain.codes]);
  const { data } = await supabase
    .from("rome_codes")
    .select("code, label")
    .in("code", codes)
    .eq("is_active", true);
  const labels = new Map((data ?? []).map((row) => [row.code, row.label]));
  return Object.fromEntries(
    JOB_DOMAINS.map((domain) => [
      domain.id,
      domain.codes.flatMap((code) => {
        const label = labels.get(code);
        return label ? [{ code, label }] : [];
      }),
    ]),
  );
}

export default async function ScanRecapPage() {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  const draft = await readDraft();
  // Nothing was read from a CV: the questionnaire runs question by question.
  if (!draft.scanned_at) redirect("/onboarding/1");

  const profile = userId ? (await loadOnboarding(supabase, userId)).profile : null;
  if (profile?.onboarding_completed) redirect("/offers");

  const values = {
    contract: profile
      ? profile.contract_chosen_at
        ? profile.target_contract
        : null
      : draft.contract_chosen_at
        ? (draft.target_contract ?? null)
        : null,
    domain: findDomainByLabel(
      profile ? profile.domain_free_text : (draft.domain_free_text ?? null),
    ),
    codes: profile ? profile.rome_codes : (draft.rome_codes ?? []),
    level: profile ? profile.diploma_level : (draft.diploma_level ?? null),
    cityLabel: profile ? profile.location_label : (draft.location_label ?? null),
    radius: profile ? profile.search_radius_km : (draft.search_radius_km ?? DEFAULT_RADIUS_KM),
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <header className="fade-up mb-6 grid gap-3">
        <span className="eyebrow">Une seule étape</span>
        <h1 className="page-title q-in">On a lu ton CV.</h1>
        <p className="text-sm text-muted-foreground">
          Vérifie ce qu’on a compris, corrige ce qui ne va pas, et on lance la recherche.
        </p>
      </header>
      <ScanNote summary={draft.scan_summary ?? null} />
      <ScanRecap
        contract={values.contract}
        domainId={values.domain?.id ?? null}
        romeCodes={values.codes}
        level={values.level}
        cityLabel={values.cityLabel}
        radius={values.radius}
        domains={JOB_DOMAINS.map(({ id, label, hint }) => ({ id, label, hint }))}
        jobsByDomain={await loadJobs(userId !== null)}
      />
    </main>
  );
}

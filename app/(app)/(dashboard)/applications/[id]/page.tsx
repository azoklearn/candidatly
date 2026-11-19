import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyCardLoader, CompanyCardSkeleton } from "@/components/company-card";
import { contractWords } from "@/lib/applications/spontaneous";
import { requireUserId } from "@/lib/auth/session";
import { requirePaidAccess } from "@/lib/billing/access";
import { cityFromAddress, formatDate } from "@/lib/format";
import { annotateSegments, diffWords } from "@/lib/letters/diff";
import { followUpMessage, isFollowUpDue } from "@/lib/letters/follow-up";
import { StoredLetterDiffSchema } from "@/lib/letters/stored";
import { JobOfferReadSchema } from "@/lib/providers/api-alternance";
import { createClient } from "@/lib/supabase/server";

import { ApplicationTracking } from "./application-tracking";
import { LetterWorkspace } from "./letter-workspace";

export const metadata: Metadata = { title: "Candidature" };

const MAX_REGENERATIONS = 3;

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  await requirePaidAccess(supabase, userId);
  const [{ data: application }, { data: profile }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, status, cover_letter_text, cover_letter_diff, regeneration_count, sent_at, next_follow_up_at, notes, company_key, company_name, company_siret, company_address, company_apply_url, company_phone, target_title, offer:offers(*)",
      )
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("first_name, last_name, target_contract")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!application || (!application.offer && !application.company_key)) notFound();
  const { offer } = application;
  // No offer: an unsolicited application to a company of the student's search (C121).
  const spontaneous = offer ? null : { contractWords: contractWords(profile?.target_contract) };
  const stored = StoredLetterDiffSchema.safeParse(application.cover_letter_diff);
  const text = application.cover_letter_text ?? "";
  const segments = stored.success
    ? annotateSegments(diffWords(stored.data.base_letter, text), stored.data.changes)
    : [{ type: "equal" as const, text }];
  const job = offer ? JobOfferReadSchema.safeParse(offer.raw) : null;
  const applyUrl = offer
    ? (job?.success ? job.data.apply.url : null) ||
      (offer.apply_channel === "external_url" ? offer.apply_target : null)
    : application.company_apply_url;
  const studentName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;
  const followUp = isFollowUpDue(application.status, application.next_follow_up_at)
    ? followUpMessage({
        title: offer ? offer.title : (application.target_title ?? ""),
        companyName: offer ? offer.company_name : application.company_name,
        sentAt: application.sent_at,
        studentName,
        ...(spontaneous ? { spontaneous } : {}),
      })
    : null;

  return (
    <div className="grid gap-6">
      <Link
        href={offer ? `/offers/${offer.id}` : "/offers"}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        {offer ? "Retour à l’offre" : "Retour aux offres"}
      </Link>
      <header className="fade-up grid gap-2">
        <p className="eyebrow">Votre candidature</p>
        <h1 className="page-title">
          Votre lettre <em>{offer ? "pour cette offre" : "pour cette entreprise"}</em>
        </h1>
        <p className="text-muted-foreground">
          {(offer
            ? [offer.title, offer.company_name, cityFromAddress(offer.location_label)]
            : [
                "Candidature spontanée",
                application.company_name,
                cityFromAddress(application.company_address),
              ]
          )
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <LetterWorkspace
          applicationId={application.id}
          text={text}
          segments={segments}
          missingInfo={
            stored.success && application.status === "draft" ? stored.data.missing_info : []
          }
          confidence={stored.success ? stored.data.confidence : null}
          regenerationsLeft={Math.max(0, MAX_REGENERATIONS - application.regeneration_count)}
          editable={application.status === "draft"}
        />
        <aside className="grid content-start gap-4">
          <ApplicationTracking
            applicationId={application.id}
            status={application.status}
            sentLabel={formatDate(application.sent_at)}
            applyUrl={applyUrl}
            followUp={followUp}
            notes={application.notes}
            spontaneous={spontaneous !== null}
            phone={offer ? null : application.company_phone}
          />
          <Suspense fallback={<CompanyCardSkeleton />}>
            <CompanyCardLoader
              offer={
                offer ?? {
                  company_siret: application.company_siret,
                  company_name: application.company_name,
                  company_website: null,
                  postal_code: null,
                  location_label: application.company_address,
                  is_delegated: false,
                  raw: {},
                }
              }
            />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

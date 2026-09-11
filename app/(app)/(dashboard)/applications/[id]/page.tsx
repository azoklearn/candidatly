import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyCardLoader, CompanyCardSkeleton } from "@/components/company-card";
import { requireUserId } from "@/lib/auth/session";
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
  const [{ data: application }, { data: profile }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, status, cover_letter_text, cover_letter_diff, regeneration_count, sent_at, next_follow_up_at, notes, offer:offers(*)",
      )
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("first_name, last_name").eq("user_id", userId).maybeSingle(),
  ]);
  if (!application?.offer) notFound();
  const { offer } = application;
  const stored = StoredLetterDiffSchema.safeParse(application.cover_letter_diff);
  const text = application.cover_letter_text ?? "";
  const segments = stored.success
    ? annotateSegments(diffWords(stored.data.base_letter, text), stored.data.changes)
    : [{ type: "equal" as const, text }];
  const job = JobOfferReadSchema.safeParse(offer.raw);
  const applyUrl =
    (job.success ? job.data.apply.url : null) ||
    (offer.apply_channel === "external_url" ? offer.apply_target : null);
  const studentName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;
  const followUp = isFollowUpDue(application.status, application.next_follow_up_at)
    ? followUpMessage({
        title: offer.title,
        companyName: offer.company_name,
        sentAt: application.sent_at,
        studentName,
      })
    : null;

  return (
    <div className="grid gap-6">
      <Link
        href={`/offers/${offer.id}`}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        Retour à l’offre
      </Link>
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Votre lettre pour cette offre</h1>
        <p className="text-muted-foreground">
          {[offer.title, offer.company_name, cityFromAddress(offer.location_label)]
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
          />
          <Suspense fallback={<CompanyCardSkeleton />}>
            <CompanyCardLoader offer={offer} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

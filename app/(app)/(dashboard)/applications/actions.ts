"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { requireUserId } from "@/lib/auth/session";
import { loadCompanyForOffer } from "@/lib/enrichment/company-for-offer";
import { DatabaseError } from "@/lib/errors";
import { cityFromAddress } from "@/lib/format";
import { LETTER_GENERATOR, adaptLetter } from "@/lib/letters/adapt";
import type { StoredLetterDiff } from "@/lib/letters/stored";
import { logger } from "@/lib/logger";
import { FOLLOW_UP_DELAY_MS } from "@/lib/letters/follow-up";
import { allowAction } from "@/lib/rate-limit";
import { toPlainText } from "@/lib/text/html";
import { JobOfferReadSchema } from "@/lib/providers/api-alternance";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type LetterFormState = { error?: string; saved?: boolean };

const log = logger.child({ area: "applications" });
const MAX_REGENERATIONS = 3;
const LetterSchema = z
  .string()
  .trim()
  .min(200, { error: "Votre lettre semble trop courte : 200 caractères minimum." })
  .max(8_000, { error: "8 000 caractères maximum." });

/** Adapts the student's current base letter to the offer (brief section 5.4, rules for now). */
async function buildLetter(
  supabase: SupabaseClient<Database>,
  userId: string,
  offer: Tables<"offers">,
): Promise<StoredLetterDiff | null> {
  const documents = await supabase
    .from("documents")
    .select("kind, extracted_text")
    .eq("user_id", userId)
    .eq("is_current", true);
  if (documents.error) throw new DatabaseError("documents.select", documents.error);
  const base = documents.data.find((d) => d.kind === "cover_letter_base")?.extracted_text;
  if (!base) return null;
  const cv = documents.data.find((d) => d.kind === "cv")?.extracted_text ?? "";
  const company = await loadCompanyForOffer(offer);
  const registryName =
    company.status === "found" ? (company.company.brand_name ?? company.company.legal_name) : null;
  const job = JobOfferReadSchema.safeParse(offer.raw);
  const result = adaptLetter({
    baseLetter: base,
    cvText: cv,
    offer: {
      title: offer.title,
      // The recruiter's spelling reads better than the registry's capitals; delegated offers
      // name the school, not the employer.
      companyName: offer.is_delegated ? null : (offer.company_name ?? registryName),
      city: cityFromAddress(offer.location_label),
      skills: job.success ? job.data.offer.desired_skills : [],
      description: toPlainText(offer.description),
    },
  });
  return {
    generator: LETTER_GENERATOR,
    base_letter: base,
    generated_letter: result.letter,
    changes: result.changes,
    confidence: result.confidence,
    missing_info: result.missing_info,
  };
}

export async function prepareApplication(offerId: string): Promise<void> {
  if (!z.uuid().safeParse(offerId).success) notFound();
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const existing = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", userId)
    .eq("offer_id", offerId)
    .maybeSingle();
  if (existing.data) redirect(`/applications/${existing.data.id}`);
  if (!(await allowAction(supabase, "prepare_application"))) redirect(`/offers/${offerId}`);
  const { data: offer } = await supabase.from("offers").select("*").eq("id", offerId).maybeSingle();
  if (!offer) notFound();

  const letter = await buildLetter(supabase, userId, offer);
  if (!letter) {
    log.warn("prepare_without_base_letter");
    redirect(`/offers/${offerId}`);
  }
  const match = await supabase
    .from("matches")
    .select("id")
    .eq("user_id", userId)
    .eq("offer_id", offerId)
    .maybeSingle();
  // Applications are created by the server only: users may edit the letter, not the rest.
  const inserted = await createAdminClient()
    .from("applications")
    .insert({
      user_id: userId,
      offer_id: offerId,
      match_id: match.data?.id ?? null,
      cover_letter_text: letter.generated_letter,
      cover_letter_diff: letter as Json,
      generation_model: LETTER_GENERATOR,
      status: "draft",
    })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const again = await supabase
        .from("applications")
        .select("id")
        .eq("user_id", userId)
        .eq("offer_id", offerId)
        .maybeSingle();
      if (again.data) redirect(`/applications/${again.data.id}`);
    }
    log.error("application_insert_failed", { code: inserted.error.code });
    throw new Error("application_insert_failed");
  }
  log.info("application_prepared", {
    confidence: letter.confidence,
    changes: letter.changes.length,
  });
  redirect(`/applications/${inserted.data.id}`);
}

export async function saveLetter(
  applicationId: string,
  _previous: LetterFormState,
  formData: FormData,
): Promise<LetterFormState> {
  if (!z.uuid().safeParse(applicationId).success) return { error: "Candidature introuvable." };
  const parsed = LetterSchema.safeParse(
    String(formData.get("letter") ?? "").replace(/\r\n?/g, "\n"),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Texte invalide." };
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { data, error } = await supabase
    .from("applications")
    .update({ cover_letter_text: parsed.data })
    .eq("id", applicationId)
    .eq("user_id", userId)
    .eq("status", "draft")
    .select("id");
  if (error || data.length === 0) {
    log.error("letter_save_failed", { code: error?.code ?? "no_row" });
    return { error: "L’enregistrement a échoué. Réessayez." };
  }
  revalidatePath(`/applications/${applicationId}`);
  return { saved: true };
}

export async function regenerateLetter(applicationId: string): Promise<void> {
  if (!z.uuid().safeParse(applicationId).success) notFound();
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { data: application } = await supabase
    .from("applications")
    .select("id, status, regeneration_count, offer:offers(*)")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!application?.offer) notFound();
  if (application.status === "draft" && application.regeneration_count < MAX_REGENERATIONS) {
    const letter = await buildLetter(supabase, userId, application.offer);
    if (letter) {
      const { error } = await createAdminClient()
        .from("applications")
        .update({
          cover_letter_text: letter.generated_letter,
          cover_letter_diff: letter as Json,
          generation_model: LETTER_GENERATOR,
          regeneration_count: application.regeneration_count + 1,
        })
        .eq("id", applicationId)
        .eq("user_id", userId)
        .eq("regeneration_count", application.regeneration_count);
      if (error) log.error("regeneration_failed", { code: error.code });
    }
  }
  revalidatePath(`/applications/${applicationId}`);
}

const SENT_STATUSES = [
  "sent",
  "viewed",
  "replied_positive",
  "replied_negative",
  "no_answer",
  "unknown",
];
const StudentStatusSchema = z.enum(["sent", "replied_positive", "replied_negative", "no_answer"]);

async function logEvent(
  userId: string,
  type: string,
  payload: Record<string, string>,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("events")
    .insert({ user_id: userId, type, payload });
  if (error) log.warn("event_insert_failed", { type, code: error.code });
}

function revalidateApplication(applicationId: string) {
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
}

/**
 * The student applied on the offer's website with the prepared letter (no email sending
 * in the MVP, docs/QUESTIONS.md C67). Status changes go through the server only.
 */
export async function markApplicationSent(applicationId: string): Promise<void> {
  if (!z.uuid().safeParse(applicationId).success) notFound();
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { data: application } = await supabase
    .from("applications")
    .select("id, status, offer_id")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!application) notFound();
  if (application.status === "draft" || application.status === "ready") {
    const now = Date.now();
    const admin = createAdminClient();
    const { error } = await admin
      .from("applications")
      .update({
        status: "sent",
        sent_at: new Date(now).toISOString(),
        sent_via: "partner_site",
        next_follow_up_at: new Date(now + FOLLOW_UP_DELAY_MS).toISOString(),
      })
      .eq("id", applicationId)
      .eq("user_id", userId)
      .in("status", ["draft", "ready"]);
    if (error) {
      log.error("application_send_failed", { code: error.code });
    } else {
      await admin
        .from("matches")
        .update({ status: "applied" })
        .eq("user_id", userId)
        .eq("offer_id", application.offer_id);
      await logEvent(userId, "application_status", {
        application_id: applicationId,
        status: "sent",
        by: "student",
      });
      log.info("application_sent", { via: "partner_site" });
    }
  }
  revalidateApplication(applicationId);
}

export async function updateApplicationStatus(
  applicationId: string,
  status: string,
): Promise<void> {
  const parsed = StudentStatusSchema.safeParse(status);
  if (!z.uuid().safeParse(applicationId).success || !parsed.success) notFound();
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { data: application } = await supabase
    .from("applications")
    .select("id, status")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!application) notFound();
  if (SENT_STATUSES.includes(application.status) && application.status !== parsed.data) {
    const closed = parsed.data !== "sent";
    const { error } = await createAdminClient()
      .from("applications")
      .update(closed ? { status: parsed.data, next_follow_up_at: null } : { status: parsed.data })
      .eq("id", applicationId)
      .eq("user_id", userId);
    if (error) log.error("application_status_failed", { code: error.code });
    else
      await logEvent(userId, "application_status", {
        application_id: applicationId,
        status: parsed.data,
        by: "student",
      });
  }
  revalidateApplication(applicationId);
}

export async function markFollowUpDone(applicationId: string): Promise<void> {
  if (!z.uuid().safeParse(applicationId).success) notFound();
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await createAdminClient()
    .from("applications")
    .update({ next_follow_up_at: null })
    .eq("id", applicationId)
    .eq("user_id", userId)
    .in("status", ["sent", "viewed"]);
  if (error) log.error("follow_up_update_failed", { code: error.code });
  else await logEvent(userId, "follow_up_sent", { application_id: applicationId });
  revalidateApplication(applicationId);
}

export type NotesFormState = { error?: string; saved?: boolean };

export async function saveNotes(
  applicationId: string,
  _previous: NotesFormState,
  formData: FormData,
): Promise<NotesFormState> {
  if (!z.uuid().safeParse(applicationId).success) return { error: "Candidature introuvable." };
  const notes = String(formData.get("notes") ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (notes.length > 2_000) return { error: "2 000 caractères maximum." };
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { data, error } = await supabase
    .from("applications")
    .update({ notes: notes || null })
    .eq("id", applicationId)
    .eq("user_id", userId)
    .select("id");
  if (error || data.length === 0) return { error: "L’enregistrement a échoué. Réessayez." };
  revalidatePath(`/applications/${applicationId}`);
  return { saved: true };
}

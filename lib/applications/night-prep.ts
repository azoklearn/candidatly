import { canPrepareLetters, loadAccess } from "@/lib/billing/access";
import { DatabaseError } from "@/lib/errors";
import { LETTER_GENERATOR } from "@/lib/letters/adapt";
import { letterForOffer } from "@/lib/letters/for-offer";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import type { Db } from "@/lib/offers/sync";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Night preparation (docs/QUESTIONS.md C123). For each student who switched it on, the
 * letter of their best new offers is adapted during the night, by the same rules as the
 * "prepare my application" button. In the morning they read, correct and send themselves:
 * nothing leaves the service, and no external API is called here.
 */

/** Letters prepared for one student in one night. */
export const NIGHT_MAX_PER_USER = 3;
/** Below this score an offer is not worth a letter nobody asked for. */
export const NIGHT_MIN_SCORE = 60;
/** Unread night drafts beyond which we stop adding more. */
export const NIGHT_MAX_PENDING = 6;
const TIME_BUDGET_MS = 40_000;
const MAX_USERS = 200;

export type NightMatch = {
  offerId: string;
  score: number;
  status: string;
  noiseKind: string | null;
};

/**
 * Which offers get a letter tonight: the best ones the student has not set aside, not from
 * a school or an agency, without an application yet. Nothing when drafts already pile up.
 */
export function planNightPrep(input: {
  matches: readonly NightMatch[];
  appliedOfferIds: ReadonlySet<string>;
  pendingNightDrafts: number;
}): string[] {
  const room = Math.min(NIGHT_MAX_PER_USER, NIGHT_MAX_PENDING - input.pendingNightDrafts);
  if (room <= 0) return [];
  return [...input.matches]
    .filter(
      (match) =>
        (match.status === "new" || match.status === "saved") &&
        match.noiseKind === null &&
        match.score >= NIGHT_MIN_SCORE &&
        !input.appliedOfferIds.has(match.offerId),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, room)
    .map((match) => match.offerId);
}

export type NightPrepSummary = { users: number; prepared: number; skipped: number };

export async function runNightPrep(options: {
  db: Db;
  now?: Date;
  logger?: Logger;
  /** Restricts the run to one account: a replay, or a test that must not touch the others. */
  onlyUserId?: string;
}): Promise<NightPrepSummary> {
  const { db } = options;
  const log = (options.logger ?? defaultLogger).child({ area: "night_prep" });
  const startedAt = (options.now ?? new Date()).getTime();
  const summary: NightPrepSummary = { users: 0, prepared: 0, skipped: 0 };

  let query = db
    .from("profiles")
    .select("user_id")
    .eq("night_prep_enabled", true)
    .eq("onboarding_completed", true);
  if (options.onlyUserId) query = query.eq("user_id", options.onlyUserId);
  const students = await query.limit(MAX_USERS);
  if (students.error) throw new DatabaseError("profiles.select", students.error);

  for (const { user_id: userId } of students.data) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      log.warn("night_prep_out_of_time", { done: summary.users });
      break;
    }
    summary.users++;
    try {
      // The tailored letter comes with the 3 mois and À vie plans, at night as by day.
      if (!canPrepareLetters(await loadAccess(db, userId))) {
        summary.skipped++;
        continue;
      }
      const [documents, matches, applications] = await Promise.all([
        db
          .from("documents")
          .select("kind, extracted_text")
          .eq("user_id", userId)
          .eq("is_current", true),
        db
          .from("matches")
          .select("id, score, status, offer:offers!inner(*)")
          .eq("user_id", userId)
          .in("status", ["new", "saved"])
          .is("offer.removed_at", null)
          .order("score", { ascending: false })
          .limit(40),
        db.from("applications").select("offer_id, status, prepared_at_night").eq("user_id", userId),
      ]);
      if (documents.error) throw new DatabaseError("documents.select", documents.error);
      if (matches.error) throw new DatabaseError("matches.select", matches.error);
      if (applications.error) throw new DatabaseError("applications.select", applications.error);

      const base = documents.data.find((d) => d.kind === "cover_letter_base")?.extracted_text;
      if (!base) {
        summary.skipped++;
        continue;
      }
      const cv = documents.data.find((d) => d.kind === "cv")?.extracted_text ?? "";
      const chosen = planNightPrep({
        matches: matches.data.map((match) => ({
          offerId: match.offer.id,
          score: Number(match.score),
          status: match.status,
          noiseKind: match.offer.noise_kind,
        })),
        appliedOfferIds: new Set(
          applications.data.flatMap((row) => (row.offer_id ? [row.offer_id] : [])),
        ),
        pendingNightDrafts: applications.data.filter(
          (row) => row.prepared_at_night && row.status === "draft",
        ).length,
      });
      for (const offerId of chosen) {
        const match = matches.data.find((item) => item.offer.id === offerId);
        if (!match) continue;
        const letter = letterForOffer({ baseLetter: base, cvText: cv, offer: match.offer });
        const inserted = await db.from("applications").insert({
          user_id: userId,
          offer_id: offerId,
          match_id: match.id,
          cover_letter_text: letter.generated_letter,
          cover_letter_diff: letter as Json,
          generation_model: LETTER_GENERATOR,
          status: "draft",
          prepared_at_night: true,
        });
        // 23505: the student prepared it themselves in the meantime.
        if (inserted.error && inserted.error.code !== "23505") {
          throw new DatabaseError("applications.insert", inserted.error);
        }
        if (!inserted.error) summary.prepared++;
      }
    } catch (error) {
      // One student's failure never stops the others.
      log.error("night_prep_user_failed", { error });
      summary.skipped++;
    }
  }
  log.info("night_prep_done", summary);
  return summary;
}

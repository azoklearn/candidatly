import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { SubmitButton } from "@/components/submit-button";
import { NIGHT_MAX_PER_USER } from "@/lib/applications/night-prep";
import { requireUserId } from "@/lib/auth/session";
import { canPrepareLetters, requirePaidAccess } from "@/lib/billing/access";
import { DatabaseError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { isFollowUpDue } from "@/lib/letters/follow-up";
import { createClient } from "@/lib/supabase/server";

import { setNightPrep } from "./actions";

export const metadata: Metadata = { title: "Candidatures" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Lettre en préparation",
  ready: "Prête à envoyer",
  sent: "Envoyée",
  viewed: "Vue",
  replied_positive: "Réponse positive",
  replied_negative: "Réponse négative",
  no_answer: "Sans réponse",
  unknown: "Statut inconnu",
};

const GROUPS = [
  { title: "À envoyer", statuses: ["draft", "ready"] },
  { title: "En attente de réponse", statuses: ["sent", "viewed", "unknown"] },
  { title: "Réponses", statuses: ["replied_positive", "replied_negative"] },
  { title: "Sans réponse", statuses: ["no_answer"] },
];

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const access = await requirePaidAccess(supabase, userId);
  const [{ data, error }, { data: profile }, { data: baseLetter }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, status, updated_at, sent_at, next_follow_up_at, company_name, prepared_at_night, offer:offers(title, company_name)",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("night_prep_enabled").eq("user_id", userId).maybeSingle(),
    supabase
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "cover_letter_base")
      .eq("is_current", true)
      .maybeSingle(),
  ]);
  if (error) throw new DatabaseError("applications.select", error);
  const nightPrep = profile?.night_prep_enabled ?? false;
  const fresh = data.filter((a) => a.prepared_at_night && a.status === "draft").length;
  const due = data.filter((a) => isFollowUpDue(a.status, a.next_follow_up_at)).length;

  return (
    <div className="grid gap-8">
      <div className="fade-up grid gap-2">
        <p className="eyebrow">Votre suivi</p>
        <h1 className="page-title">
          Vos <em>candidatures</em>
        </h1>
        <p className="text-sm text-muted-foreground">
          {due > 0
            ? `${due} relance${due > 1 ? "s" : ""} conseillée${due > 1 ? "s" : ""} : ouvrez la candidature pour copier le message.`
            : "Préparez une lettre depuis une offre ou pour une entreprise de votre sélection, envoyez-la, puis suivez les réponses ici."}
        </p>
      </div>
      {/* Letters prepared during the night, for the plans that include the letter (C123). */}
      {canPrepareLetters(access) ? (
        <section
          aria-label="Préparation de nuit"
          className="panel-warm fade-up grid gap-3 rounded-3xl border p-5 sm:flex sm:items-center sm:justify-between"
        >
          <div className="grid gap-1 text-sm">
            <p className="font-heading text-lg font-semibold tracking-[-0.03em]">
              Préparation de nuit {nightPrep ? "activée" : ""}
            </p>
            <p className="max-w-prose text-muted-foreground">
              {nightPrep && fresh > 0
                ? `${fresh} ${fresh > 1 ? "lettres préparées vous attendent" : "lettre préparée vous attend"} ci-dessous. Vous relisez et vous envoyez vous-même.`
                : `Chaque nuit, la lettre est préparée pour vos ${NIGHT_MAX_PER_USER} meilleures nouvelles offres. Le matin, vous relisez et vous envoyez vous-même : rien ne part sans vous.`}
            </p>
            {!baseLetter ? (
              <p className="text-muted-foreground">
                Il faut d’abord une lettre de base :{" "}
                <Link
                  href="/account"
                  className="font-medium text-brand underline underline-offset-4"
                >
                  l’ajouter depuis le compte
                </Link>
                .
              </p>
            ) : null}
          </div>
          <form action={setNightPrep.bind(null, !nightPrep)}>
            <SubmitButton variant={nightPrep ? "outline" : "default"} pendingLabel="Un instant…">
              {nightPrep ? "Désactiver" : "Activer"}
            </SubmitButton>
          </form>
        </section>
      ) : null}
      {data.length === 0 ? (
        <div className="panel-tint grid gap-2 rounded-2xl border p-6 text-sm">
          <p className="section-title">
            Votre première candidature <em>vous attend</em>
          </p>
          <p className="text-muted-foreground">
            Ouvrez une offre et cliquez sur « Préparer ma candidature » :{" "}
            <Link href="/offers" className="font-medium text-brand underline underline-offset-4">
              voir vos offres
            </Link>
            .
          </p>
        </div>
      ) : (
        GROUPS.map((group) => {
          const items = data.filter((a) => group.statuses.includes(a.status));
          if (items.length === 0) return null;
          return (
            <section key={group.title} className="grid gap-3">
              <h2 className="text-lg font-bold tracking-[-0.03em]">
                {group.title} ({items.length})
              </h2>
              <ul className="grid gap-3">
                {items.map((application, index) => (
                  <li
                    key={application.id}
                    style={{ "--i": index } as CSSProperties}
                    className="card-lift panel rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 sm:p-5"
                  >
                    <div className="grid gap-1">
                      <Link
                        href={`/applications/${application.id}`}
                        className="font-semibold tracking-[-0.02em] hover:text-brand"
                      >
                        {application.offer?.title ??
                          (application.company_name ? "Candidature spontanée" : "Offre")}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {[
                          application.offer?.company_name ?? application.company_name,
                          application.sent_at
                            ? `envoyée le ${formatDate(application.sent_at)}`
                            : `modifiée le ${formatDate(application.updated_at)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {application.prepared_at_night && application.status === "draft" ? (
                        <span className="match-pill">✦ Préparée cette nuit</span>
                      ) : null}
                      {isFollowUpDue(application.status, application.next_follow_up_at) ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-950 dark:bg-amber-900/50 dark:text-amber-50">
                          Relance conseillée
                        </span>
                      ) : null}
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {STATUS_LABELS[application.status] ?? application.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

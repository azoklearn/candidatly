import type { Metadata } from "next";
import Link from "next/link";

import { requireUserId } from "@/lib/auth/session";
import { requirePaidAccess } from "@/lib/billing/access";
import { DatabaseError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { isFollowUpDue } from "@/lib/letters/follow-up";
import { createClient } from "@/lib/supabase/server";

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
  await requirePaidAccess(supabase, userId);
  const { data, error } = await supabase
    .from("applications")
    .select("id, status, updated_at, sent_at, next_follow_up_at, offer:offers(title, company_name)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new DatabaseError("applications.select", error);
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
            : "Préparez une lettre depuis une offre, candidatez sur le site de l’offre, puis suivez les réponses ici."}
        </p>
      </div>
      {data.length === 0 ? (
        <div className="grid gap-2 rounded-2xl border bg-card p-6 text-sm">
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
                {items.map((application) => (
                  <li
                    key={application.id}
                    className="card-lift flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 sm:p-5"
                  >
                    <div className="grid gap-1">
                      <Link
                        href={`/applications/${application.id}`}
                        className="font-semibold tracking-[-0.02em] hover:text-brand"
                      >
                        {application.offer?.title ?? "Offre"}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {[
                          application.offer?.company_name,
                          application.sent_at
                            ? `envoyée le ${formatDate(application.sent_at)}`
                            : `modifiée le ${formatDate(application.updated_at)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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

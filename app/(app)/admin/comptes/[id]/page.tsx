import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadAdminAccount } from "@/lib/admin/account";
import { requireAdmin } from "@/lib/admin/guard";
import { parseUserId } from "@/lib/admin/search";
import { formatDate, formatDistance, formatRelativeDays, STUDY_LEVEL_LABELS } from "@/lib/format";
import { ACTIVE_STATUSES } from "@/lib/billing/subscriptions";
import { PLANS } from "@/lib/pricing";

import {
  APPLICATION_STATUS_LABELS,
  CONTRACT_LABELS,
  Facts,
  MATCH_STATUS_LABELS,
  Section,
  Stat,
  Table,
} from "../../_components/ui";

export const metadata: Metadata = {
  title: "Admin · Compte",
  robots: { index: false, follow: false },
};

const when = (iso: string | null | undefined) =>
  iso ? `${formatDate(iso)} (${formatRelativeDays(iso) ?? "—"})` : "—";
const planName = (id: string | null) => PLANS.find((plan) => plan.id === id)?.name ?? id ?? "—";
const bytes = (size: number | null) =>
  size === null
    ? "—"
    : size > 1_000_000
      ? `${(size / 1_000_000).toFixed(1)} Mo`
      : `${Math.round(size / 1000)} Ko`;

/** One account, everything about it, read-only (docs/QUESTIONS.md C112). */
export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const userId = parseUserId((await params).id);
  if (!userId) notFound();
  const account = await loadAdminAccount(userId);
  if (!account) notFound();
  const { profile } = account;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Sans nom";
  const matchTotal = Object.values(account.matchStatuses).reduce((a, b) => a + b, 0);
  const sent = account.applications.filter((row) => row.sent_at !== null).length;
  const active = account.subscriptions.find((row) => ACTIVE_STATUSES.has(row.status));

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-8">
      <header className="grid gap-2">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <span aria-hidden>← </span>Tous les comptes
        </Link>
        <h1 className="page-title">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {profile.email ?? "—"} · inscrit le {formatDate(profile.created_at)}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Accès"
          value={profile.billing_exempt ? "Exempté" : active ? planName(active.plan) : "Aucun"}
          hint={active ? `${active.provider} · ${active.status}` : undefined}
        />
        <Stat
          label="Offres proposées"
          value={String(matchTotal)}
          hint={Object.entries(account.matchStatuses)
            .map(([status, count]) => `${MATCH_STATUS_LABELS[status] ?? status} : ${count}`)
            .join(" · ")}
        />
        <Stat
          label="Candidatures"
          value={String(account.applications.length)}
          hint={`${sent} envoyées`}
        />
        <Stat label="Crédits" value={account.credits === null ? "—" : String(account.credits)} />
      </div>

      <Section title="Profil et recherche">
        <Facts
          items={[
            ["Adresse email", profile.email],
            ["Téléphone", profile.phone],
            ["Questionnaire", profile.onboarding_completed ? "Terminé" : "En cours"],
            [
              "Contrat cherché",
              profile.target_contract ? CONTRACT_LABELS[profile.target_contract] : null,
            ],
            ["Domaine", profile.domain_free_text],
            ["Niveau", profile.diploma_level ? STUDY_LEVEL_LABELS[profile.diploma_level] : null],
            ["Ville", profile.location_label],
            ["Rayon", formatDistance(profile.search_radius_km)],
            ["École", profile.school],
            ["Formation", profile.degree_label],
            [
              "Forfait choisi",
              profile.chosen_plan
                ? `${planName(profile.chosen_plan)}${profile.chosen_billing === "annual" ? " (annuel, ancien tarif)" : ""} · ${when(profile.plan_chosen_at)}`
                : null,
            ],
            ["Dernière modification", when(profile.updated_at)],
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {account.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun métier choisi.</p>
          ) : (
            account.jobs.map((job) => (
              <span key={job.code} className="rounded-full border bg-card px-3 py-1 text-sm">
                {job.label}{" "}
                <span className="font-mono text-xs text-muted-foreground">{job.code}</span>
              </span>
            ))
          )}
        </div>
      </Section>

      <Section title="Abonnements">
        <Table
          head={["Forfait", "Fournisseur", "Statut", "Fin de période", "Créé"]}
          rows={account.subscriptions.map((row) => [
            `${planName(row.plan)}${row.provider === "whop" ? ` (ancien tarif${row.billing === "annual" ? ", annuel" : ""})` : ""}`,
            row.provider,
            `${row.status}${row.cancel_at_period_end ? " · arrêt prévu" : ""}`,
            when(row.current_period_end),
            when(row.created_at),
          ])}
        />
      </Section>

      <Section title="Candidatures">
        <Table
          head={["Offre", "Statut", "Envoyée", "Relance prévue", "Créée"]}
          rows={account.applications.map((row) => [
            <span key="offer" className="grid">
              <span className="font-medium">{row.offer?.title ?? "Offre retirée"}</span>
              <span className="text-xs text-muted-foreground">
                {[row.offer?.company_name, row.offer?.location_label].filter(Boolean).join(" · ")}
              </span>
            </span>,
            APPLICATION_STATUS_LABELS[row.status] ?? row.status,
            row.sent_at ? `${when(row.sent_at)}${row.sent_via ? ` · ${row.sent_via}` : ""}` : "—",
            when(row.next_follow_up_at),
            when(row.created_at),
          ])}
        />
      </Section>

      <Section title="Meilleures offres proposées">
        <Table
          head={["Offre", "Score", "Statut", "Publiée"]}
          rows={account.topMatches.map((row) => [
            <span key="offer" className="grid">
              <span className="font-medium">
                {row.offer.title}
                {row.offer.removed_at ? " (retirée)" : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {[row.offer.company_name, row.offer.location_label].filter(Boolean).join(" · ")}
              </span>
            </span>,
            String(row.score),
            MATCH_STATUS_LABELS[row.status] ?? row.status,
            formatRelativeDays(row.offer.published_at) ?? "—",
          ])}
        />
      </Section>

      <Section title="Documents">
        <p className="text-sm text-muted-foreground">
          Nom, taille et date seulement : le contenu des CV et des lettres reste privé.
        </p>
        <Table
          head={["Type", "Fichier", "Taille", "Actuel", "Ajouté"]}
          rows={account.documents.map((row) => [
            row.kind === "cv" ? "CV" : "Lettre de base",
            row.original_filename ?? "Texte collé",
            bytes(row.size_bytes),
            row.is_current ? "oui" : "non",
            when(row.created_at),
          ])}
        />
      </Section>

      <Section title="Derniers événements">
        <Table
          head={["Événement", "Quand"]}
          rows={account.events.map((row) => [row.type, when(row.created_at)])}
        />
      </Section>
    </div>
  );
}

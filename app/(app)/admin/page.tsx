import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { loadAdminData } from "@/lib/admin/load";
import { isAdminEmail } from "@/lib/admin/emails";
import { buildAccounts, buildOverview, percent } from "@/lib/admin/overview";
import { getAdminEmails } from "@/lib/env";
import { formatDate, formatRelativeDays } from "@/lib/format";
import { formatEuros, PLANS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-3xl font-bold tracking-[-0.04em]">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-bold tracking-[-0.03em]">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Rien pour l’instant.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-3 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, index) => (
            <tr key={index} className="border-b last:border-b-0">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only view of the whole service, for the owner only (docs/QUESTIONS.md C90). */
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;
  if (!isAdminEmail(email, getAdminEmails())) notFound();

  const data = await loadAdminData();
  const overview = buildOverview(data);
  const accounts = buildAccounts(data);
  const planName = (id: string | null) =>
    PLANS.find((plan) => plan.id === id)?.name ?? (id ? id : "—");

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-8">
      <header className="grid gap-2">
        <p className="eyebrow">Interne</p>
        <h1 className="page-title">
          Tableau de <em>bord</em>
        </h1>
        <p className="text-sm text-muted-foreground">
          Chiffres en direct de la base. Lecture seule.{" "}
          <Link href="/offers" className="underline underline-offset-4">
            Retour à l’application
          </Link>
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Comptes"
          value={String(overview.accounts)}
          hint={`${overview.signups7d} sur les 7 derniers jours`}
        />
        <Stat
          label="Questionnaires terminés"
          value={String(overview.onboarded)}
          hint={`${percent(overview.onboarded, overview.accounts)} % des comptes`}
        />
        <Stat
          label="Abonnements actifs"
          value={String(overview.activeSubscriptions)}
          hint={`${percent(overview.activeSubscriptions, overview.accounts)} % des comptes`}
        />
        <Stat
          label="Revenu mensuel"
          value={formatEuros(overview.monthlyRevenueCents)}
          hint="Annuel ramené au mois"
        />
        <Stat
          label="Candidatures"
          value={String(overview.applications)}
          hint={`${overview.applicationsSent} envoyées`}
        />
        <Stat label="Offres en ligne" value={String(overview.liveOffers)} />
        <Stat label="Correspondances" value={String(overview.matches)} />
        <Stat label="Entreprises qui recrutent" value={String(overview.hiringCompanies)} />
      </div>

      <Section title="Forfaits">
        <Table
          head={["Forfait", "Choisi après le questionnaire", "Abonnements actifs"]}
          rows={PLANS.map((plan) => [
            plan.name,
            String(overview.planChoices[plan.id]),
            String(overview.subscriptionsByPlan[plan.id]),
          ])}
        />
      </Section>

      <Section title="Candidatures par statut">
        <Table
          head={["Statut", "Nombre"]}
          rows={Object.entries(overview.applicationsByStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => [STATUS_LABELS[status] ?? status, String(count)])}
        />
      </Section>

      <Section title={`Comptes (${accounts.length})`}>
        {data.truncated ? (
          <p className="text-sm text-muted-foreground">
            Seuls les 1 000 comptes les plus récents sont comptés ici.
          </p>
        ) : null}
        <Table
          head={[
            "Compte",
            "Inscrit",
            "Questionnaire",
            "Ville",
            "Forfait choisi",
            "Abonnement",
            "Candidatures",
          ]}
          rows={accounts.map((account) => [
            <span key="mail" className="grid">
              <span className="font-medium">{account.email ?? "—"}</span>
              {account.name ? (
                <span className="text-xs text-muted-foreground">{account.name}</span>
              ) : null}
            </span>,
            <span key="date" className="whitespace-nowrap">
              {formatRelativeDays(account.createdAt) ?? formatDate(account.createdAt)}
            </span>,
            account.onboarded ? "Terminé" : "En cours",
            account.location ?? "—",
            account.chosenPlan
              ? `${planName(account.chosenPlan)}${account.chosenBilling === "annual" ? " (annuel)" : ""}`
              : "—",
            account.subscription
              ? `${planName(account.subscription.plan)} · ${account.subscription.status}`
              : account.exempt
                ? "Exempté"
                : "—",
            `${account.applications} dont ${account.sent} envoyées`,
          ])}
        />
      </Section>

      <Section title="Derniers événements de paiement">
        <Table
          head={["Type", "Reçu", "Traité"]}
          rows={data.billingEvents.map((event) => [
            `${event.provider} · ${event.type}`,
            formatRelativeDays(event.created_at) ?? "—",
            event.processed_at ? "oui" : "non",
          ])}
        />
      </Section>

      <Section title="Dernières recherches d’offres">
        <Table
          head={["Recherche", "Source", "Résultats", "Statut", "Quand"]}
          rows={data.searchRuns.map((run) => [
            <span key="key" className="font-mono text-xs">
              {run.query_key.slice(0, 40)}
            </span>,
            run.source,
            run.result_count === null ? "—" : String(run.result_count),
            run.status_code === null ? "—" : String(run.status_code),
            formatRelativeDays(run.fetched_at) ?? "—",
          ])}
        />
      </Section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin/guard";
import { loadAdminData } from "@/lib/admin/load";
import { buildAccounts, buildActivity, buildOverview, percent } from "@/lib/admin/overview";
import { matchesAccountQuery } from "@/lib/admin/search";
import {
  formatDateTime,
  formatDistance,
  formatRelativeDays,
  STUDY_LEVEL_LABELS,
} from "@/lib/format";
import { formatEuros, PLANS } from "@/lib/pricing";

import type { ReactNode } from "react";

import { APPLICATION_STATUS_LABELS, CONTRACT_LABELS, Section, Stat, Table } from "./_components/ui";

/** The exact moment, with "il y a 3 jours" underneath. */
function When({ at }: { at: string | null | undefined }): ReactNode {
  if (!at) return "—";
  return (
    <span className="grid whitespace-nowrap">
      <span className="tabular-nums">{formatDateTime(at)}</span>
      <span className="text-xs text-muted-foreground">{formatRelativeDays(at)}</span>
    </span>
  );
}

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Read-only view of the whole service, for the accounts of ADMIN_EMAILS (docs/QUESTIONS.md
 * C90, C112). Each account opens on its own page.
 */
export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  const data = await loadAdminData();
  const overview = buildOverview(data);
  const allAccounts = buildAccounts(data);
  const accounts = allAccounts.filter((account) => matchesAccountQuery(account, query));
  const emailOf = new Map(allAccounts.map((account) => [account.userId, account.email]));
  const chosePlan = data.profiles.filter((profile) => profile.chosen_plan !== null).length;
  const planName = (id: string | null) =>
    PLANS.find((plan) => plan.id === id)?.name ?? (id ? id : "—");
  const activity = buildActivity({
    profiles: data.profiles,
    applications: data.recentApplications,
    billingEvents: data.billingEvents,
    planName,
  });

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
          hint="3 mois ramené au mois, À vie non compté"
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

      <Section title="Entonnoir">
        <Table
          head={["Étape", "Comptes", "Part des comptes"]}
          rows={[
            ["Compte créé", overview.accounts, overview.accounts],
            ["Questionnaire terminé", overview.onboarded, overview.accounts],
            ["Forfait choisi", chosePlan, overview.accounts],
            ["Abonnement actif", overview.activeSubscriptions, overview.accounts],
          ].map(([label, count, total]) => [
            String(label),
            String(count),
            `${percent(Number(count), Number(total))} %`,
          ])}
        />
      </Section>

      <Section title="Fil d’activité">
        <p className="text-sm text-muted-foreground">
          Heure de Paris. Les réponses des visiteurs sans compte ne sont pas enregistrées : elles
          restent dans leur navigateur jusqu’à la création du compte.
        </p>
        <Table
          head={["Quand", "Quoi", "Compte", "Détail"]}
          rows={activity.map((item) => [
            <When key="at" at={item.at} />,
            item.kind,
            item.userId ? (
              <Link key="who" href={`/admin/comptes/${item.userId}`} className="hover:underline">
                {emailOf.get(item.userId) ?? "—"}
              </Link>
            ) : (
              "—"
            ),
            item.detail || "—",
          ])}
        />
      </Section>

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
            .map(([status, count]) => [APPLICATION_STATUS_LABELS[status] ?? status, String(count)])}
        />
      </Section>

      <Section
        title={
          query
            ? `Comptes (${accounts.length} sur ${allAccounts.length})`
            : `Comptes (${accounts.length})`
        }
      >
        <form className="flex flex-wrap gap-2" role="search">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Adresse, nom ou ville"
            aria-label="Chercher un compte"
            className="h-10 min-w-0 flex-1 rounded-full border bg-card px-4 text-sm"
          />
          <button
            type="submit"
            className="h-10 rounded-full border bg-card px-4 text-sm font-medium"
          >
            Chercher
          </button>
          {query ? (
            <Link href="/admin" className="self-center text-sm underline underline-offset-4">
              Tout afficher
            </Link>
          ) : null}
        </form>
        {data.truncated ? (
          <p className="text-sm text-muted-foreground">
            Seuls les 1 000 comptes les plus récents sont comptés ici.
          </p>
        ) : null}
        <Table
          head={[
            "Compte",
            "Inscrit",
            "Dernière connexion",
            "Réponses au questionnaire",
            "Forfait choisi",
            "Abonnement",
            "Candidatures",
          ]}
          rows={accounts.map((account) => {
            const jobs = account.answers.romeCodes.map((code) => data.romeLabels[code] ?? code);
            const level = account.answers.level as keyof typeof STUDY_LEVEL_LABELS | null;
            return [
              <Link
                key="mail"
                href={`/admin/comptes/${account.userId}`}
                className="grid hover:underline"
              >
                <span className="font-medium">{account.email ?? "—"}</span>
                {account.name ? (
                  <span className="text-xs text-muted-foreground">{account.name}</span>
                ) : null}
              </Link>,
              <When key="created" at={account.createdAt} />,
              <When key="seen" at={data.lastSignIn[account.userId]} />,
              <span key="answers" className="grid min-w-56 gap-0.5 text-xs">
                <span className="text-sm font-medium">
                  {[
                    account.answers.contract ? CONTRACT_LABELS[account.answers.contract] : null,
                    level ? STUDY_LEVEL_LABELS[level] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
                {account.answers.domain ? <span>{account.answers.domain}</span> : null}
                {jobs.length > 0 ? (
                  <span className="text-muted-foreground">{jobs.join(", ")}</span>
                ) : null}
                {account.location ? (
                  <span className="text-muted-foreground">
                    {account.location}
                    {account.answers.radiusKm !== null
                      ? ` · ${formatDistance(account.answers.radiusKm)}`
                      : ""}
                  </span>
                ) : null}
                <span className={account.onboarded ? "text-brand" : "text-muted-foreground"}>
                  {account.onboarded ? "Questionnaire terminé" : "Questionnaire en cours"}
                </span>
              </span>,
              account.chosenPlan ? (
                <span key="plan" className="grid">
                  <span>{planName(account.chosenPlan)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(account.planChosenAt) ?? ""}
                  </span>
                </span>
              ) : (
                "—"
              ),
              account.subscription
                ? `${planName(account.subscription.plan)} · ${account.subscription.status}`
                : account.exempt
                  ? "Exempté"
                  : "—",
              `${account.applications} dont ${account.sent} envoyées`,
            ];
          })}
        />
      </Section>

      <Section title="Dernières candidatures">
        <Table
          head={["Compte", "Offre", "Statut", "Créée"]}
          rows={data.recentApplications.slice(0, 20).map((row) => [
            <Link key="who" href={`/admin/comptes/${row.user_id}`} className="hover:underline">
              {emailOf.get(row.user_id) ?? "—"}
            </Link>,
            <span key="offer" className="grid">
              <span className="font-medium">
                {row.offer?.title ?? (row.company_name ? "Candidature spontanée" : "Offre retirée")}
              </span>
              <span className="text-xs text-muted-foreground">
                {row.offer?.company_name ?? row.company_name ?? ""}
              </span>
            </span>,
            APPLICATION_STATUS_LABELS[row.status] ?? row.status,
            <When key="at" at={row.created_at} />,
          ])}
        />
      </Section>

      <Section title="Derniers événements de paiement">
        <Table
          head={["Type", "Reçu", "Traité"]}
          rows={data.billingEvents.map((event) => [
            `${event.provider} · ${event.type}`,
            <When key="at" at={event.created_at} />,
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
            <When key="at" at={run.fetched_at} />,
          ])}
        />
      </Section>
    </div>
  );
}

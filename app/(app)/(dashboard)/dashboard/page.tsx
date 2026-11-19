import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";
import { canPrepareLetters, requirePaidAccess } from "@/lib/billing/access";
import {
  buildFeatures,
  buildTasks,
  countDashboard,
  type DashboardFeature,
  type FeatureState,
} from "@/lib/dashboard/summary";
import { DatabaseError } from "@/lib/errors";
import {
  cityFromAddress,
  formatDate,
  formatDistance,
  formatRelativeDays,
  STUDY_LEVEL_LABELS,
} from "@/lib/format";
import { companiesOnly } from "@/lib/offers/contract-mode";
import { loadHiringCompanies } from "@/lib/offers/hiring-companies";
import { isNoiseKind } from "@/lib/offers/noise";
import { countHiringCompanies } from "@/lib/plan-choice";
import { findPlan } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

import { HiringCompanyCard } from "../offers/_components/hiring-company-card";

export const metadata: Metadata = { title: "Tableau de bord" };

const CONTRACTS: Record<string, string> = {
  alternance: "Alternance",
  stage: "Stage",
  job_etudiant: "Job étudiant",
  both: "Alternance ou stage",
};

const SEARCHES: Record<string, string> = {
  basic: "3 recherches par jour",
  plus: "10 recherches par jour",
  premium: "Recherches illimitées",
};

const STATE_CLASS: Record<FeatureState, string> = {
  included: "bg-[var(--pastel-sun)] text-muted-foreground",
  on: "bg-emerald-100 text-emerald-950",
  off: "bg-muted text-muted-foreground",
  todo: "bg-amber-100 text-amber-950",
  locked: "border border-dashed border-foreground/25 text-muted-foreground",
};

const TOP_OFFERS = 3;
const TOP_COMPANIES = 4;

function Stat({
  value,
  label,
  hint,
  href,
  index,
}: {
  value: number;
  label: string;
  hint: string;
  href: string;
  index: number;
}) {
  return (
    <li style={{ "--i": index } as CSSProperties} className="rise">
      <Link
        href={href}
        className="card-lift panel grid h-full content-start gap-1 rounded-3xl border bg-card p-5"
      >
        <span className="font-heading text-4xl leading-none font-semibold tracking-[-0.04em] tabular-nums">
          {value}
        </span>
        <span className="mt-1 text-sm font-semibold tracking-[-0.01em]">{label}</span>
        <span className="text-xs leading-snug text-muted-foreground">{hint}</span>
      </Link>
    </li>
  );
}

function FeatureTile({ feature, index }: { feature: DashboardFeature; index: number }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="gem size-10 shrink-0 rounded-[14px] text-lg"
          style={{ "--gem": feature.tint } as CSSProperties}
        >
          {feature.icon}
        </span>
        <span
          className={`rounded-md px-2 py-1 text-[0.7rem] font-medium ${STATE_CLASS[feature.state]}`}
        >
          {feature.state === "locked" ? "🔒 " : ""}
          {feature.stateLabel}
        </span>
      </span>
      <span className="font-heading text-[1.0625rem] leading-snug font-semibold tracking-[-0.02em]">
        {feature.title}
      </span>
      <span className="text-sm leading-snug text-muted-foreground">{feature.body}</span>
    </>
  );
  const shell = "panel grid h-full content-start gap-2 rounded-3xl border bg-card p-5";
  return (
    <li style={{ "--i": index } as CSSProperties} className="rise">
      {feature.href ? (
        <Link href={feature.href} className={`card-lift ${shell}`}>
          {body}
        </Link>
      ) : (
        <div className={`${shell} ${feature.state === "locked" ? "opacity-75" : ""}`}>{body}</div>
      )}
    </li>
  );
}

/**
 * Home of the paid area (docs/QUESTIONS.md C124): the student's own figures, what to do
 * next, their best offers and every feature with its state. Read-only: each block opens the
 * page where the thing is done.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const access = await requirePaidAccess(supabase, userId);

  const [matches, applications, profile, documents] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, score, status, offer:offers!inner(id, title, company_name, location_label, published_at, noise_kind, removed_at)",
      )
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .is("offer.removed_at", null)
      .order("score", { ascending: false })
      .limit(300),
    supabase
      .from("applications")
      .select("status, next_follow_up_at, prepared_at_night")
      .eq("user_id", userId),
    supabase
      .from("profiles")
      .select(
        "first_name, rome_codes, location_label, location_lat, location_lng, search_radius_km, diploma_level, target_contract, hide_noise, night_prep_enabled",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("documents").select("kind").eq("user_id", userId).eq("is_current", true),
  ]);
  if (matches.error) throw new DatabaseError("matches.select", matches.error);
  if (applications.error) throw new DatabaseError("applications.select", applications.error);
  if (profile.error) throw new DatabaseError("profiles.select", profile.error);
  if (documents.error) throw new DatabaseError("documents.select", documents.error);

  const me = profile.data;
  const domainOnly = companiesOnly(me?.target_contract);
  const [companyCount, companies, trades] = await Promise.all([
    me ? countHiringCompanies(supabase, me) : 0,
    me ? loadHiringCompanies(supabase, me, TOP_COMPANIES) : [],
    me && me.rome_codes.length > 0
      ? supabase.from("rome_codes").select("code, label").in("code", me.rome_codes)
      : { data: [] as { code: string; label: string }[] },
  ]);

  const kinds = new Set(documents.data.map((document) => document.kind));
  const input = {
    matches: matches.data.map((match) => ({
      status: match.status,
      noise: isNoiseKind(match.offer.noise_kind),
    })),
    applications: applications.data.map((application) => ({
      status: application.status,
      nextFollowUpAt: application.next_follow_up_at,
      preparedAtNight: application.prepared_at_night,
    })),
    hasCv: kinds.has("cv"),
    hasBaseLetter: kinds.has("cover_letter_base"),
    letters: canPrepareLetters(access),
    nightPrep: me?.night_prep_enabled ?? false,
    hideNoise: me?.hide_noise ?? true,
    companiesOnly: domainOnly,
    companies: companyCount,
  };
  const counts = countDashboard(input);
  const tasks = buildTasks(input, counts);
  const features = buildFeatures(input);
  const anyLocked = features.some((feature) => feature.state === "locked");

  // The best offers still to open: never a school or an agency, never one already applied to.
  const best = domainOnly
    ? []
    : matches.data
        .filter(
          (match) =>
            (match.status === "new" || match.status === "saved") &&
            !isNoiseKind(match.offer.noise_kind),
        )
        .slice(0, TOP_OFFERS);

  const subscription = access.paywall ? access.subscription : null;
  const planName = findPlan(subscription?.plan)?.name;
  const periodEnd = formatDate(subscription?.current_period_end);
  const planLine = subscription
    ? [
        `Forfait ${planName}`,
        subscription.billing === "lifetime"
          ? "accès à vie"
          : periodEnd
            ? `${subscription.cancel_at_period_end ? "se termine le" : "renouvellement le"} ${periodEnd}`
            : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : access.exempt
      ? "Accès complet offert"
      : null;

  const tradeLabels = (trades.data ?? []).map((trade) => trade.label);
  const search = [
    { label: "Contrat", value: me ? (CONTRACTS[me.target_contract] ?? null) : null },
    { label: "Métiers", value: tradeLabels.length > 0 ? tradeLabels.join(", ") : null },
    {
      label: "Zone",
      value: me?.location_label
        ? `${cityFromAddress(me.location_label) ?? me.location_label} · ${formatDistance(me.search_radius_km)} autour`
        : null,
    },
    { label: "Niveau", value: me?.diploma_level ? STUDY_LEVEL_LABELS[me.diploma_level] : null },
    { label: "Recherches", value: access.plan ? SEARCHES[access.plan] : null },
  ].filter((line): line is { label: string; value: string } => line.value !== null);

  const stats = domainOnly
    ? [
        {
          value: companyCount,
          label: companyCount > 1 ? "Entreprises à contacter" : "Entreprise à contacter",
          hint: "Dans vos métiers, près de chez vous",
          href: "/offers",
        },
      ]
    : [
        {
          value: counts.newOffers,
          label: counts.newOffers > 1 ? "Offres à découvrir" : "Offre à découvrir",
          hint: "Pas encore triées",
          href: "/offers",
        },
        {
          value: counts.savedOffers,
          label: counts.savedOffers > 1 ? "Offres enregistrées" : "Offre enregistrée",
          hint: "Vos favoris",
          href: "/offers?view=saved",
        },
      ];
  stats.push(
    {
      value: counts.toSend,
      label: counts.toSend > 1 ? "Candidatures à envoyer" : "Candidature à envoyer",
      hint: "Lettre en préparation ou prête",
      href: "/applications",
    },
    {
      value: counts.waiting,
      label: "En attente de réponse",
      hint:
        counts.replies > 0
          ? `${counts.replies} ${counts.replies > 1 ? "réponses reçues" : "réponse reçue"}`
          : "Candidatures envoyées",
      href: "/applications",
    },
  );

  return (
    <div className="grid gap-12">
      <header className="fade-up flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <p className="eyebrow">Votre espace</p>
          <h1 className="page-title">
            {me?.first_name ? (
              <>
                Bonjour <em>{me.first_name}</em>
              </>
            ) : (
              <>
                Votre <em>tableau de bord</em>
              </>
            )}
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Où vous en êtes, quoi faire maintenant, et tout ce que votre forfait vous ouvre.
          </p>
        </div>
        {planLine ? (
          <Link href="/account" className="chip rounded-full px-4 py-2 text-sm">
            {planLine}
          </Link>
        ) : null}
      </header>

      <ul
        aria-label="Vos chiffres"
        className={`grid gap-3 ${stats.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}
      >
        {stats.map((stat, index) => (
          <Stat key={stat.label} {...stat} index={index} />
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <section aria-labelledby="todo" className="grid gap-4">
          <h2 id="todo" className="section-title">
            À faire <em>maintenant</em>
          </h2>
          {tasks.length > 0 ? (
            <ol className="panel notebook grid rounded-3xl border bg-card p-2">
              {tasks.map((task, index) => (
                <li
                  key={task.id}
                  style={{ "--i": index } as CSSProperties}
                  className="rise flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5"
                >
                  <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                    <p className="font-heading text-[1.0625rem] leading-snug font-semibold tracking-[-0.02em]">
                      {task.title}
                    </p>
                    <p className="text-sm leading-snug text-muted-foreground">{task.body}</p>
                  </div>
                  <Link
                    href={task.href}
                    className={buttonVariants({
                      variant: index === 0 ? "default" : "outline",
                      size: "sm",
                    })}
                  >
                    {task.cta} <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="panel-tint grid gap-2 rounded-3xl border p-6 text-sm">
              <p className="font-heading text-lg font-semibold tracking-[-0.03em]">
                Tout est à jour
              </p>
              <p className="max-w-prose text-muted-foreground">
                Rien ne vous attend pour l’instant. De nouvelles offres sont publiées chaque jour :
                repassez voir votre sélection.
              </p>
            </div>
          )}
        </section>

        <section aria-labelledby="search" className="grid gap-4">
          <h2 id="search" className="section-title">
            Votre <em>recherche</em>
          </h2>
          <div className="panel-warm grid gap-4 rounded-3xl border p-5">
            <dl className="grid gap-3 text-sm">
              {search.map((line) => (
                <div key={line.label} className="grid grid-cols-[5.5rem_1fr] gap-3">
                  <dt className="text-muted-foreground">{line.label}</dt>
                  <dd className="font-medium">{line.value}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/account"
              className="w-fit text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              Modifier ma recherche <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </div>

      {best.length > 0 ? (
        <section aria-labelledby="best" className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="best" className="section-title">
              Vos meilleures <em>offres</em>
            </h2>
            <Link
              href="/offers"
              className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              Toutes vos offres <span aria-hidden>→</span>
            </Link>
          </div>
          <ul className="grid gap-3">
            {best.map((match, index) => (
              <li key={match.id} style={{ "--i": index } as CSSProperties} className="rise">
                <Link
                  href={`/offers/${match.offer.id}`}
                  className="card-lift panel flex items-start justify-between gap-4 rounded-2xl border bg-card p-4 sm:p-5"
                >
                  <span className="grid min-w-0 gap-1">
                    <span className="text-[1.05rem] leading-snug font-semibold tracking-[-0.02em]">
                      {match.offer.title}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {[
                        match.offer.company_name,
                        cityFromAddress(match.offer.location_label),
                        formatRelativeDays(match.offer.published_at),
                        match.status === "saved" ? "enregistrée" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="match-pill shrink-0" title="Correspondance avec votre profil">
                    ✦ {Math.round(Number(match.score))} %
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {companies.length > 0 ? (
        <section id="entreprises" aria-labelledby="companies" className="grid scroll-mt-28 gap-4">
          <div className="grid gap-1.5">
            <h2 id="companies" className="section-title">
              Entreprises <em>à contacter</em>
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              {domainOnly
                ? "Des entreprises de vos métiers près de chez vous."
                : "Elles embauchent souvent des alternants dans vos métiers, sans offre publiée en ce moment."}{" "}
              Être listée ne garantit pas qu’un poste est ouvert.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 sm:items-start">
            {companies.map((company, index) => (
              <HiringCompanyCard
                key={company.id}
                company={company}
                index={index}
                domainOnly={domainOnly}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="features" className="grid gap-4">
        <div className="grid gap-1.5">
          <h2 id="features" className="section-title">
            Tout ce que vous <em>pouvez faire</em>
          </h2>
          {anyLocked ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              La lettre adaptée, la candidature spontanée et la préparation de nuit sont incluses
              dans les forfaits 3 mois et À vie.
              {subscription?.manage_url ? (
                <>
                  {" "}
                  <a
                    href={subscription.manage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand underline underline-offset-4"
                  >
                    Changer de forfait
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureTile key={feature.id} feature={feature} index={index} />
          ))}
        </ul>
      </section>
    </div>
  );
}

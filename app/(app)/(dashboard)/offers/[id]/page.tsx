import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyCardLoader, CompanyCardSkeleton } from "@/components/company-card";
import { PendingOverlay } from "@/components/pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import {
  DIPLOMA_LABELS,
  REMOTE_LABELS,
  cityFromAddress,
  contractLabel,
  formatDate,
  formatDistance,
} from "@/lib/format";
import { readScoreReasons } from "@/lib/matching/reasons";
import { JobOfferReadSchema } from "@/lib/providers/api-alternance";
import { createClient } from "@/lib/supabase/server";
import { toPlainText } from "@/lib/text/html";

import { prepareApplication } from "../../applications/actions";

export const metadata: Metadata = { title: "Offre" };

const ROME_REASONS = {
  exact: "Correspond à un métier de votre profil",
  related: "Métier proche de votre profil",
  none: "",
};
const DIPLOMA_REASONS = {
  exact: "Niveau de diplôme identique",
  adjacent: "Niveau de diplôme voisin",
  mismatch: "Niveau de diplôme différent",
  unspecified: "Niveau de diplôme non précisé",
};

function SkillList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="font-medium">{title}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const userId = await requireUserId(supabase);

  const { data: offer } = await supabase.from("offers").select("*").eq("id", id).maybeSingle();
  if (!offer) notFound();
  const [{ data: match }, { data: application }] = await Promise.all([
    supabase
      .from("matches")
      .select("score, score_reasons")
      .eq("user_id", userId)
      .eq("offer_id", id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id")
      .eq("user_id", userId)
      .eq("offer_id", id)
      .maybeSingle(),
  ]);
  const parsed = JobOfferReadSchema.safeParse(offer.raw);
  const job = parsed.success ? parsed.data : null;
  const reasons = readScoreReasons(match?.score_reasons);
  const facts = [
    ["Contrat", contractLabel(offer.contract_types)],
    ["Niveau visé", offer.diploma_level ? DIPLOMA_LABELS[offer.diploma_level] : null],
    ["Début", formatDate(job?.contract.start)],
    ["Durée", job?.contract.duration ? `${job.contract.duration} mois` : null],
    ["Mode de travail", job?.contract.remote ? REMOTE_LABELS[job.contract.remote] : null],
    ["Lieu", offer.location_label],
    ["Publiée le", formatDate(offer.published_at)],
    ["Expire le", formatDate(offer.expires_at)],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));

  return (
    <div className="grid gap-6">
      <Link
        href="/offers"
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <span aria-hidden>← </span>Retour aux offres
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <article className="fade-up grid content-start gap-6">
          <header className="grid gap-2">
            <p className="eyebrow">Offre d’alternance</p>
            <h1 className="text-3xl leading-tight font-bold tracking-[-0.045em] text-balance">
              {offer.title}
            </h1>
            <p className="text-muted-foreground">
              {[offer.company_name, cityFromAddress(offer.location_label)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="grid gap-0.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <section className="grid gap-2">
            <h2 className="font-medium">Description du poste</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {toPlainText(offer.description) || "Pas de description."}
            </p>
          </section>
          <SkillList title="Compétences attendues" items={job?.offer.desired_skills ?? []} />
          <SkillList
            title="Compétences à acquérir"
            items={job?.offer.to_be_acquired_skills ?? []}
          />
          <SkillList title="Conditions d’accès" items={job?.offer.access_conditions ?? []} />
        </article>
        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidater</CardTitle>
              <CardDescription>
                Nous adaptons votre lettre de motivation à cette offre. Aucun crédit n’est utilisé
                avant l’envoi.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {application ? (
                <Link href={`/applications/${application.id}`} className={buttonVariants()}>
                  Reprendre ma candidature
                </Link>
              ) : (
                <form action={prepareApplication.bind(null, offer.id)}>
                  <SubmitButton
                    variant="shiny"
                    size="lg"
                    className="w-full"
                    pendingLabel="Préparation de votre lettre…"
                  >
                    Préparer ma candidature
                  </SubmitButton>
                  <PendingOverlay
                    title={
                      <>
                        On prépare votre <em>candidature</em>
                      </>
                    }
                    messages={[
                      "On lit l’offre en détail…",
                      "On adapte votre lettre de motivation…",
                      "On met en forme votre dossier…",
                    ]}
                  />
                </form>
              )}
              {job?.apply.url ? (
                <a
                  href={job.apply.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-4"
                >
                  Voir l’offre sur le site d’origine
                </a>
              ) : null}
            </CardContent>
          </Card>
          {reasons ? (
            <Card>
              <CardHeader>
                <CardTitle>Pourquoi cette offre</CardTitle>
                <CardDescription>
                  Correspondance de {Math.round(Number(match?.score ?? 0))} % avec votre profil.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {ROME_REASONS[reasons.rome] ? <li>{ROME_REASONS[reasons.rome]}</li> : null}
                  <li>À {formatDistance(reasons.distanceKm)} de votre adresse</li>
                  <li>{DIPLOMA_REASONS[reasons.diploma]}</li>
                  {reasons.keywords.length > 0 ? (
                    <li>Mots de votre CV présents : {reasons.keywords.join(", ")}</li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          <Suspense fallback={<CompanyCardSkeleton />}>
            <CompanyCardLoader offer={offer} />
          </Suspense>
          <p className="text-xs text-muted-foreground">
            Source : La bonne alternance, via l’API Alternance. Données mises à jour le{" "}
            {formatDate(offer.last_seen_at)}.
          </p>
        </aside>
      </div>
    </div>
  );
}

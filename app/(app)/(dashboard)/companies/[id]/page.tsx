import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CompanyCardLoader, CompanyCardSkeleton } from "@/components/company-card";
import { SubmitButton } from "@/components/submit-button";
import { Tag } from "@/components/tag";
import { TrackedLink } from "@/components/tracked-link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENTS } from "@/lib/analytics";
import { companyKey } from "@/lib/applications/spontaneous";
import { requireUserId } from "@/lib/auth/session";
import { canPrepareLetters, requirePaidAccess } from "@/lib/billing/access";
import { cityFromAddress, formatDistance } from "@/lib/format";
import { haversineKm } from "@/lib/matching/score";
import { formatPhone, telHref } from "@/lib/offers/contact";
import { companiesOnly } from "@/lib/offers/contract-mode";
import { directoryUrl, formatHeadcount, sectorLabel } from "@/lib/offers/hiring-companies";
import { extractPostalCode } from "@/lib/providers/api-alternance";
import { createClient } from "@/lib/supabase/server";

import { prepareSpontaneousApplication } from "../../applications/actions";

export const metadata: Metadata = { title: "Entreprise" };

/**
 * A company of the student's search that published no offer (docs/QUESTIONS.md C121): who
 * it is, who runs it according to the public register, how to reach it, and a letter
 * adapted to it. Being listed never means a position is open, and the page says so.
 */
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const access = await requirePaidAccess(supabase, userId);
  const [{ data: company }, { data: profile }, { data: baseLetter }] = await Promise.all([
    supabase
      .from("hiring_companies")
      .select(
        "id, name, siret, naf_code, naf_label, headcount, address, lat, lng, apply_url, phone",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("location_lat, location_lng, target_contract")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "cover_letter_base")
      .eq("is_current", true)
      .maybeSingle(),
  ]);
  if (!company) notFound();
  const key = companyKey(company);
  const { data: application } = key
    ? await supabase
        .from("applications")
        .select("id")
        .eq("user_id", userId)
        .eq("company_key", key)
        .maybeSingle()
    : { data: null };

  // An internship or a student job: a company of the student's trades, nothing more (C106).
  const domainOnly = companiesOnly(profile?.target_contract);
  const distance =
    company.lat !== null &&
    company.lng !== null &&
    profile?.location_lat != null &&
    profile.location_lng != null
      ? haversineKm(
          { lat: profile.location_lat, lng: profile.location_lng },
          { lat: company.lat, lng: company.lng },
        )
      : null;
  const sector = sectorLabel(company.naf_code, company.naf_label);
  const headcount = formatHeadcount(company.headcount);
  const phone = formatPhone(company.phone);
  const tel = telHref(company.phone);
  const directory = directoryUrl(company.siret);

  return (
    <div className="grid gap-6">
      <Link href="/offers" className="text-sm text-muted-foreground underline underline-offset-4">
        Retour aux offres
      </Link>
      <header className="fade-up grid gap-3">
        <p className="eyebrow">Candidature spontanée</p>
        <h1 className="page-title">{company.name}</h1>
        <p className="text-muted-foreground">
          {[cityFromAddress(company.address), distance === null ? null : formatDistance(distance)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="match-pill">
            {domainOnly ? "✦ Dans vos métiers" : "✦ Fort potentiel d’embauche"}
          </span>
          {sector ? <Tag>{sector}</Tag> : null}
          {headcount ? <Tag>{headcount}</Tag> : null}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-4">
          <div className="panel-warm grid gap-2 rounded-3xl border p-5 text-sm">
            <p className="font-heading text-lg font-semibold tracking-[-0.03em]">
              Aucune offre publiée ici
            </p>
            <p className="text-muted-foreground">
              {domainOnly
                ? "Cette entreprise est dans votre sélection parce qu’elle exerce dans vos métiers, près de chez vous."
                : "Cette entreprise est dans votre sélection parce qu’elle embauche souvent des alternants dans vos métiers."}{" "}
              Être listée ne garantit pas qu’un poste est ouvert : vous lui proposez votre profil.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Candidature spontanée</CardTitle>
              <CardDescription>
                Votre lettre de base est adaptée à cette entreprise, sans rien inventer. Vous la
                relisez, vous l’envoyez vous-même, et elle rejoint votre suivi.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid justify-items-start gap-3 text-sm">
              {application ? (
                <Link href={`/applications/${application.id}`} className={buttonVariants()}>
                  Reprendre ma candidature
                </Link>
              ) : !canPrepareLetters(access) ? (
                <>
                  <p className="text-muted-foreground">
                    La lettre adaptée à chaque entreprise est incluse dans les forfaits 3 mois et À
                    vie.
                  </p>
                  <Link href="/forfait/choisir" className={buttonVariants({ variant: "shiny" })}>
                    Voir les forfaits
                  </Link>
                </>
              ) : !baseLetter ? (
                <>
                  <p className="text-muted-foreground">
                    Ajoutez d’abord votre lettre de motivation de base : c’est elle qu’on adapte.
                  </p>
                  <Link href="/account" className={buttonVariants({ variant: "outline" })}>
                    Ajouter ma lettre
                  </Link>
                </>
              ) : (
                <form action={prepareSpontaneousApplication.bind(null, company.id)}>
                  <SubmitButton variant="shiny" size="lg" pendingLabel="On prépare votre lettre…">
                    Préparer ma candidature spontanée
                  </SubmitButton>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Contacter l’entreprise</CardTitle>
            </CardHeader>
            <CardContent className="grid justify-items-start gap-3 text-sm">
              {tel && phone ? (
                <TrackedLink
                  href={tel}
                  event={EVENTS.recruiterCalled}
                  properties={{ emplacement: "entreprise" }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Appeler {phone}
                </TrackedLink>
              ) : (
                <p className="text-muted-foreground">
                  Aucun téléphone connu pour cette entreprise.
                </p>
              )}
              {company.address ? <p className="text-muted-foreground">{company.address}</p> : null}
              {directory ? (
                <a
                  href={directory}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  Fiche publique de l’entreprise <span aria-hidden>↗</span>
                </a>
              ) : null}
            </CardContent>
          </Card>
          {/* Who runs it, from the public register: name and role, no email (C121). */}
          <Suspense fallback={<CompanyCardSkeleton />}>
            <CompanyCardLoader
              offer={{
                company_siret: company.siret,
                company_name: company.name,
                company_website: null,
                postal_code: company.address ? extractPostalCode(company.address) : null,
                location_label: company.address,
                is_delegated: false,
                raw: {},
              }}
            />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

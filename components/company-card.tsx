import { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadCompanyForOffer,
  type CompanyCardData,
  type OfferForCompany,
} from "@/lib/enrichment/company-for-offer";
import { CompanySummarySchema, type CompanySummary } from "@/lib/enrichment/company-summary";
import { headcountLabel } from "@/lib/enrichment/labels";

/** Employer card (brief sections 5.3 and 6.2), built from the registry and the website. */

const ExecutivesSchema = z.array(z.object({ name: z.string(), role: z.string() })).catch([]);

const STATUS_MESSAGES: Record<Exclude<CompanyCardData["status"], "found">, string> = {
  delegated:
    "Cette offre est gérée par un établissement de formation : l’employeur n’est pas précisé.",
  unknown: "L’offre ne donne ni SIRET ni nom d’employeur exploitable.",
  not_found: "Cet employeur n’a pas été trouvé dans le répertoire des entreprises.",
  low_confidence:
    "Plusieurs entreprises portent un nom proche : nous préférons ne rien afficher plutôt que de nous tromper.",
  unavailable: "La fiche entreprise est momentanément indisponible.",
};

const SOURCE_LABELS: Record<CompanySummary["what_they_do_source"], string> = {
  website: "D’après son site web.",
  offer: "D’après la présentation de l’offre.",
  registry: "D’après le répertoire des entreprises.",
  none: "",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1">
      <h3 className="font-medium">{title}</h3>
      {children}
    </section>
  );
}

export function CompanyCard({
  data,
  fallbackName,
}: {
  data: CompanyCardData;
  fallbackName: string | null;
}) {
  if (data.status !== "found") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>L’employeur</CardTitle>
          <CardDescription>{STATUS_MESSAGES[data.status]}</CardDescription>
        </CardHeader>
        {fallbackName && data.status !== "delegated" ? (
          <CardContent className="text-sm font-medium">{fallbackName}</CardContent>
        ) : null}
      </Card>
    );
  }
  const { company } = data;
  const parsed = CompanySummarySchema.safeParse(company.summary);
  const summary = parsed.success ? parsed.data : null;
  const executives = ExecutivesSchema.parse(company.executives);
  const name = company.brand_name ?? company.legal_name ?? fallbackName ?? "Employeur";
  const headline = [company.naf_label, headcountLabel(company.headcount_range)]
    .filter(Boolean)
    .join(" · ");
  const siteRead = (summary?.sources.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        {headline ? <CardDescription>{headline}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {company.legal_name && company.legal_name !== name ? (
          <p className="text-muted-foreground">Raison sociale : {company.legal_name}</p>
        ) : null}
        {summary?.what_they_do ? (
          <Section title="Ce qu’elle fait">
            <p>{summary.what_they_do}</p>
            <p className="text-xs text-muted-foreground">
              {SOURCE_LABELS[summary.what_they_do_source]}
            </p>
          </Section>
        ) : null}
        {summary?.size_and_context ? (
          <p className="text-muted-foreground">{summary.size_and_context}</p>
        ) : null}
        {executives.length > 0 ? (
          <Section title="Dirigeants">
            <ul className="text-muted-foreground">
              {executives.map((executive) => (
                <li key={`${executive.name}-${executive.role}`}>
                  {executive.name}, {executive.role.toLowerCase()}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section title="Pistes d’accroche">
          {summary && summary.hooks_for_candidate.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {summary.hooks_for_candidate.map((hook) => (
                <li key={hook}>{hook}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Pas assez d’informations pour proposer une piste.
            </p>
          )}
        </Section>
        <Section title="Actualités">
          <p className="text-muted-foreground">
            {!company.website
              ? "Site web non exploité : l’offre n’en indique pas."
              : siteRead
                ? "Aucune actualité relevée automatiquement sur son site."
                : "Site web non exploité : il n’a pas pu être lu."}
          </p>
        </Section>
        {company.confidence !== null && company.confidence < 1 ? (
          <p className="text-xs text-muted-foreground">
            Employeur identifié par son nom et son code postal.
          </p>
        ) : null}
        <div className="grid gap-1 text-xs text-muted-foreground">
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all underline underline-offset-4"
            >
              Site de l’entreprise
            </a>
          ) : null}
          {summary?.sources
            .filter((url) => url !== company.website)
            .map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all underline underline-offset-4"
              >
                {url}
              </a>
            ))}
          <p>
            Source :{" "}
            <a
              href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${company.siren}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Annuaire des Entreprises
            </a>{" "}
            (INSEE, INPI), Licence Ouverte 2.0.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanyCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>L’employeur</CardTitle>
        <CardDescription aria-live="polite">Préparation de la fiche entreprise…</CardDescription>
      </CardHeader>
    </Card>
  );
}

/** Streams in after the page: the first visit may wait for the registry and the website. */
export async function CompanyCardLoader({ offer }: { offer: OfferForCompany }) {
  const data = await loadCompanyForOffer(offer);
  return <CompanyCard data={data} fallbackName={offer.company_name} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { tradeLabels } from "@/lib/guides/trades";
import { PRESET_CITIES } from "@/lib/onboarding/cities";
import { findDomain, JOB_DOMAINS } from "@/lib/onboarding/domains";

type Params = Promise<{ domaine: string }>;

/** The list of trades changes with the nomenclature, not with each visit. */
export const revalidate = 86400;

export function generateStaticParams() {
  return JOB_DOMAINS.map((domain) => ({ domaine: domain.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const domain = findDomain((await params).domaine);
  if (!domain) return {};
  return {
    title: `Alternance en ${domain.label.toLowerCase()}`,
    description: `Trouver une alternance en ${domain.label.toLowerCase()} : les métiers visés, la méthode, et les offres publiées qui collent à ton profil.`,
    alternates: { canonical: `/alternance/${domain.id}` },
  };
}

/** One public page per domain of the questionnaire (docs/QUESTIONS.md C122). */
export default async function DomainPage({ params }: { params: Params }) {
  const domain = findDomain((await params).domaine);
  if (!domain) notFound();
  const trades = await tradeLabels(domain);
  const name = domain.label.toLowerCase();

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-14 sm:px-6">
      <header className="fade-up grid gap-3">
        <h1 className="page-title">
          Alternance en <em>{name}</em>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {domain.hint}. JobGPT cherche les offres d’alternance publiées dans ces métiers, près de
          chez toi, et les trie selon ton profil.
        </p>
        <Link href="/" className={`${buttonVariants({ variant: "shiny", size: "lg" })} mt-2 w-fit`}>
          Déposer mon CV
        </Link>
      </header>

      {trades.length > 0 ? (
        <section className="grid gap-4">
          <h2 className="section-title">Les métiers qu’on cherche pour toi</h2>
          <p className="text-sm text-muted-foreground">
            Ce sont les intitulés officiels des métiers. Tu en choisis jusqu’à cinq dans le
            questionnaire.
          </p>
          <ul className="flex flex-wrap gap-2">
            {trades.map((trade) => (
              <li key={trade} className="chip rounded-full px-4 py-2 text-sm">
                {trade}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4">
        <h2 className="section-title">Comment ça se passe</h2>
        <ol className="grid gap-3">
          {[
            [
              "Tu déposes ton CV",
              "On y lit ton niveau, ton domaine et ta ville. Sans CV, quelques questions à cliquer font le même travail.",
            ],
            [
              "Tu vois les offres qui collent",
              "Chaque offre reçoit un score, avec ce qui colle et ce qui manque par rapport à ton profil.",
            ],
            [
              "Tu candidates avec une lettre adaptée",
              "Ta lettre de base est adaptée à chaque entreprise, sans rien inventer. Tu relis, tu envoies, et on suit tes réponses.",
            ],
          ].map(([title, body], index) => (
            <li key={title} className="panel flex gap-4 rounded-3xl border bg-card p-5">
              <span
                aria-hidden
                className="plan-badge grid size-8 shrink-0 place-items-center rounded-full font-heading text-sm font-semibold"
              >
                {index + 1}
              </span>
              <span className="grid gap-1">
                <span className="font-heading text-lg font-semibold tracking-[-0.03em]">
                  {title}
                </span>
                <span className="text-sm text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3">
        <h2 className="section-title">Par ville</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {PRESET_CITIES.map((city) => (
            <li key={city.id}>
              <Link
                href={`/alternance/ville/${city.id}`}
                className="underline underline-offset-4 hover:text-brand"
              >
                Alternance à {city.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="section-title">Pour aller plus loin</h2>
        <ul className="grid gap-2 text-sm">
          <li>
            <Link href="/guides/trouver-une-alternance" className="underline underline-offset-4">
              Trouver une alternance : la méthode en 5 étapes
            </Link>
          </li>
          <li>
            <Link href="/outils/salaire-alternance" className="underline underline-offset-4">
              Simulateur de salaire en alternance
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}

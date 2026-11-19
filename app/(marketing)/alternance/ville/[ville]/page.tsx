import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { findPresetCity, PRESET_CITIES, RADIUS_OPTIONS } from "@/lib/onboarding/cities";
import { JOB_DOMAINS } from "@/lib/onboarding/domains";

type Params = Promise<{ ville: string }>;

export function generateStaticParams() {
  return PRESET_CITIES.map((city) => ({ ville: city.id }));
}

/** "à Paris", "à Lyon": every preset city takes "à". */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const city = findPresetCity((await params).ville);
  if (!city) return {};
  return {
    title: `Alternance à ${city.label}`,
    description: `Trouver une alternance à ${city.label} et autour : les offres publiées qui collent à ton métier et à ton niveau, triées pour toi.`,
    alternates: { canonical: `/alternance/ville/${city.id}` },
  };
}

/** One public page per city of the questionnaire (docs/QUESTIONS.md C122). No figure. */
export default async function CityPage({ params }: { params: Params }) {
  const city = findPresetCity((await params).ville);
  if (!city) notFound();
  const widest = Math.max(...RADIUS_OPTIONS);

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-14 sm:px-6">
      <header className="fade-up grid gap-3">
        <h1 className="page-title">
          Alternance à <em>{city.label}</em>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          JobGPT cherche les offres d’alternance publiées à {city.label} et autour, jusqu’à {widest}{" "}
          km, puis les trie selon ton métier et ton niveau. Tu choisis ton rayon.
        </p>
        <Link href="/" className={`${buttonVariants({ variant: "shiny", size: "lg" })} mt-2 w-fit`}>
          Déposer mon CV
        </Link>
      </header>

      <section className="grid gap-4">
        <h2 className="section-title">Choisis ton domaine</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {JOB_DOMAINS.map((domain) => (
            <li key={domain.id}>
              <Link
                href={`/alternance/${domain.id}`}
                className="card-lift panel grid gap-1 rounded-3xl border bg-card p-5"
              >
                <span className="font-heading text-lg font-semibold tracking-[-0.03em]">
                  {domain.label}
                </span>
                <span className="text-sm text-muted-foreground">{domain.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="section-title">Ce que tu trouves à {city.label}</h2>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          <li>Les offres d’alternance publiées, retirées de ta sélection dès qu’elles expirent.</li>
          <li>
            Les entreprises de ton domaine qui embauchent souvent des alternants, pour une
            candidature spontanée. Être listée ne garantit pas qu’un poste est ouvert.
          </li>
          <li>
            Pour un stage ou un job étudiant : les entreprises de tes métiers près de chez toi.
          </li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="section-title">Autres villes</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {PRESET_CITIES.filter((other) => other.id !== city.id).map((other) => (
            <li key={other.id}>
              <Link
                href={`/alternance/ville/${other.id}`}
                className="underline underline-offset-4 hover:text-brand"
              >
                Alternance à {other.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

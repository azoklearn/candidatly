import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  PAY_SOURCES,
  SMIC_HOURLY_CENTS,
  SMIC_MONTHLY_CENTS,
  SMIC_SINCE,
} from "@/lib/tools/apprentice-pay";

import { SalarySimulator } from "./simulator";

export const metadata: Metadata = {
  title: "Simulateur de salaire en alternance",
  description:
    "Calcule ton salaire minimum en alternance selon ton contrat, ton âge et ton année : apprentissage ou professionnalisation, d’après la grille légale.",
  alternates: { canonical: "/outils/salaire-alternance" },
};

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Public tool (docs/QUESTIONS.md C122): the legal minimum, three clicks, no account. */
export default function SalaryToolPage() {
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-14 sm:px-6">
      <header className="fade-up grid gap-3">
        <h1 className="page-title max-w-3xl">
          Ton salaire en <em>alternance</em>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Le minimum légal dépend de ton contrat, de ton âge et de ton année. Choisis, le montant se
          met à jour.
        </p>
      </header>

      <SalarySimulator />

      <section className="grid gap-3 text-sm text-muted-foreground">
        <p>
          Calcul sur le Smic en vigueur depuis le {formatDate(SMIC_SINCE)} :{" "}
          {euros.format(SMIC_MONTHLY_CENTS / 100)} brut par mois pour 35 heures par semaine, soit{" "}
          {euros.format(SMIC_HOURLY_CENTS / 100)} brut de l’heure. Montants hors Mayotte, pour un
          temps plein.
        </p>
        <p>
          Sources :{" "}
          {PAY_SOURCES.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? ", " : ""}
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {source.label}
              </a>
            </span>
          ))}
          . Ce simulateur donne un ordre de grandeur : seul ton contrat fait foi.
        </p>
      </section>

      <section className="panel-tint grid justify-items-start gap-4 rounded-3xl border p-7">
        <h2 className="section-title">
          Il te manque <em>l’entreprise</em> ?
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Dépose ton CV : JobGPT garde les offres d’alternance qui collent à ton profil et adapte ta
          lettre à chaque entreprise.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className={buttonVariants({ variant: "shiny", size: "lg" })}>
            Lancer ma recherche
          </Link>
          <Link
            href="/guides/salaire-alternance"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Comprendre le calcul
          </Link>
        </div>
      </section>
    </main>
  );
}

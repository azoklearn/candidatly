import type { Metadata } from "next";

import { PricingTable } from "@/components/pricing-table";
import { loadPlanCounts } from "@/lib/plan-choice";
import { featuredBadge } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Les forfaits Candidatly : offres d’alternance près de chez vous, lettre adaptée à chaque entreprise, recherches illimitées.",
};

export default async function PricingPage() {
  const badge = featuredBadge(await loadPlanCounts());
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6">
      <header className="fade-up grid justify-items-center gap-3 text-center">
        <p className="eyebrow">Tarifs</p>
        <h1 className="page-title">
          Un forfait pour chaque <em>recherche</em>
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Choisissez selon le temps que vous voulez gagner. Chaque prix est aussi affiché par jour.
        </p>
      </header>
      <PricingTable badge={badge} />
      <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
        En formule annuelle, le prix barré est le prix du même forfait payé au mois. Les fonctions
        marquées « Bientôt » ne sont pas encore disponibles.
      </p>
    </main>
  );
}

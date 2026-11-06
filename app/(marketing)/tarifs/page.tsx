import type { Metadata } from "next";
import Link from "next/link";

import { PlanProof } from "@/components/plan-proof";
import { PricingTable } from "@/components/pricing-table";
import { buttonVariants } from "@/components/ui/button";
import { loadPlanCounts } from "@/lib/plan-choice";
import { featuredBadge } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Les forfaits JobGPT : offres d’alternance près de chez toi, lettre adaptée à chaque entreprise, recherches illimitées.",
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
          Choisis selon le temps que tu veux gagner. Chaque prix est aussi affiché par jour, et tu
          vois ta vraie sélection avant de payer.
        </p>
      </header>
      <PricingTable badge={badge} />
      <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">
        En formule annuelle, le prix barré est le prix du même forfait payé au mois. Les fonctions
        marquées « Bientôt » ne sont pas encore disponibles.
      </p>
      <PlanProof preview="Dépose ton CV sur l’accueil : la recherche part pour de vrai, et l’écran suivant te dit ce qu’elle a trouvé pour toi avant que tu paies quoi que ce soit. Le nombre dépend de ton métier et de ton rayon, donc on ne t’annonce pas un chiffre à l’avance." />
      <section className="fade-up grid justify-items-center gap-4 rounded-3xl border bg-card p-8 text-center">
        <h2 className="section-title">
          Vois ta sélection, <em>puis décide</em>
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Deux minutes de questions, ou ton CV déposé en une seconde. La recherche tourne avant le
          paiement : tu sais ce que tu achètes.
        </p>
        <Link href="/onboarding/1" className={buttonVariants({ variant: "shiny", size: "lg" })}>
          Lancer ma recherche <span aria-hidden>→</span>
        </Link>
      </section>
    </main>
  );
}

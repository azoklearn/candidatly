import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Crédits" };

export default function CreditsPage() {
  return (
    <ComingSoon
      title="Vos crédits"
      description="Votre solde et votre historique apparaîtront ici."
    />
  );
}

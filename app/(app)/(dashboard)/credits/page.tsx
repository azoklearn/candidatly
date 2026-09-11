import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Crédits" };

export default function CreditsPage() {
  return (
    <ComingSoon
      title="Crédits"
      description="Pendant la bêta, Candidatly est entièrement gratuit : aucune carte bancaire, aucun crédit à acheter. Les éventuelles formules payantes seront annoncées avant leur mise en place."
    />
  );
}

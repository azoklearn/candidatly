import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Crédits" };

export default function CreditsPage() {
  return (
    <ComingSoon
      title="Crédits"
      description="Aucun crédit à acheter pour le moment. Les éventuelles formules payantes seront annoncées avant leur mise en place."
    />
  );
}

import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Offres" };

export default function OffersPage() {
  return (
    <ComingSoon
      title="Vos offres"
      description="Les offres d’alternance qui correspondent à votre profil apparaîtront ici."
    />
  );
}

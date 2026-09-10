import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Compte" };

export default function AccountPage() {
  return (
    <ComingSoon
      title="Votre compte"
      description="Profil, documents, export et suppression de vos données seront gérés ici."
    />
  );
}

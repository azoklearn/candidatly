import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Candidatures" };

export default function ApplicationsPage() {
  return (
    <ComingSoon
      title="Vos candidatures"
      description="Le suivi de vos candidatures et les relances suggérées apparaîtront ici."
    />
  );
}

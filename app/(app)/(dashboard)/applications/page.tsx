import type { Metadata } from "next";
import Link from "next/link";

import { requireUserId } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Candidatures" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Lettre en préparation",
  ready: "Prête à envoyer",
  sent: "Envoyée",
  viewed: "Vue",
  positive: "Réponse positive",
  negative: "Réponse négative",
  no_answer: "Sans réponse",
};

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { data, error } = await supabase
    .from("applications")
    .select("id, status, updated_at, offer:offers(title, company_name)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new DatabaseError("applications.select", error);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vos candidatures</h1>
        <p className="text-sm text-muted-foreground">
          Les lettres que vous avez préparées. Le suivi des réponses et les relances arrivent
          prochainement.
        </p>
      </div>
      {data.length === 0 ? (
        <div className="grid gap-2 rounded-xl border p-6 text-sm">
          <p className="font-medium">Aucune candidature pour le moment.</p>
          <p className="text-muted-foreground">
            Ouvrez une offre et cliquez sur « Préparer ma candidature » :{" "}
            <Link href="/offers" className="underline underline-offset-4">
              voir vos offres
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {data.map((application) => (
            <li
              key={application.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div className="grid gap-1">
                <Link
                  href={`/applications/${application.id}`}
                  className="font-medium hover:underline"
                >
                  {application.offer?.title ?? "Offre"}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {[
                    application.offer?.company_name,
                    `modifiée le ${formatDate(application.updated_at)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {STATUS_LABELS[application.status] ?? application.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

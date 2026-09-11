import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { socialProofMessage, type LandingStats } from "@/lib/social-proof";
import { createAdminClient } from "@/lib/supabase/admin";

const CTA_CLASS = `${buttonVariants({ size: "lg" })} h-12 px-6 text-base`;

const STEPS = [
  "Répondez à quelques questions sur vous et ce que vous cherchez.",
  "Découvrez les offres qui vous correspondent, près de chez vous.",
  "Candidatez avec une lettre de motivation adaptée à chaque offre.",
];

/** Real numbers for the proof line; none when the database is unreachable. */
async function loadStats(): Promise<LandingStats | null> {
  try {
    const admin = createAdminClient();
    const [placed, students] = await Promise.all([
      admin.from("applications").select("user_id").eq("status", "replied_positive").limit(10_000),
      admin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("onboarding_completed", true),
    ]);
    if (placed.error || students.error) return null;
    return {
      placedStudents: new Set(placed.data.map((row) => row.user_id)).size,
      students: students.count ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, stats] = await Promise.all([searchParams, loadStats()]);
  const deleted = params.compte === "supprime";

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-20 px-6 py-20 text-center sm:py-28">
      {deleted ? (
        <p role="status" className="rounded-xl border p-4 text-sm">
          Votre compte et vos données ont été supprimés.
        </p>
      ) : null}
      <section className="grid justify-items-center gap-6">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Trouvez votre stage ou votre alternance.
        </h1>
        <p className="max-w-xl text-lg text-balance text-muted-foreground">
          Répondez à quelques questions : Candidatly vous montre les offres qui vous correspondent
          et prépare votre lettre de motivation pour chacune.
        </p>
        <Link href="/signup" className={CTA_CLASS}>
          Trouver mon stage ou mon alternance
        </Link>
        <p className="text-sm text-muted-foreground">{socialProofMessage(stats)}</p>
      </section>
      <section className="grid gap-6">
        <h2 className="text-xl font-semibold tracking-tight">Comment ça marche</h2>
        <ol className="grid gap-4 text-left sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step} className="grid content-start gap-2 rounded-xl border p-5">
              <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="grid justify-items-center gap-4">
        <p className="text-lg font-medium">Prêt à trouver votre place ?</p>
        <Link href="/signup" className={CTA_CLASS}>
          Trouver les offres qui me correspondent
        </Link>
        <p className="text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </section>
    </main>
  );
}

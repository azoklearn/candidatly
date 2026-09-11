import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

const STEPS = [
  {
    title: "Votre profil en quelques minutes",
    text: "Formation préparée, métiers visés, ville et rayon de recherche, CV et lettre de motivation.",
  },
  {
    title: "Les offres qui vous correspondent",
    text: "Des offres d’alternance publiées, classées selon vos métiers, votre niveau et la distance.",
  },
  {
    title: "Une lettre adaptée à chaque offre",
    text: "Votre lettre reprend l’entreprise, le poste et les compétences demandées. Chaque changement est surligné et expliqué.",
  },
  {
    title: "Un suivi sans oubli",
    text: "Vous candidatez sur le site de l’offre, puis vous suivez les réponses et recevez un message de relance prêt à envoyer.",
  },
];

const PRINCIPLES = [
  {
    title: "Rien d’inventé",
    text: "Votre lettre ne contient que ce que vous avez écrit, votre CV et les informations de l’offre.",
  },
  {
    title: "Des sources officielles",
    text: "Les offres viennent de La bonne alternance et les fiches employeur de l’Annuaire des Entreprises.",
  },
  {
    title: "Vos données vous appartiennent",
    text: "Vos documents restent privés. Vous pouvez tout télécharger ou tout effacer depuis votre compte.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const deleted = (await searchParams).compte === "supprime";
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-16 px-6 py-16">
      {deleted ? (
        <p role="status" className="rounded-xl border p-4 text-sm">
          Votre compte et vos données ont été supprimés.
        </p>
      ) : null}
      <section className="grid max-w-3xl gap-6">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Trouvez votre alternance et envoyez des candidatures qui vous ressemblent.
        </h1>
        <p className="text-lg text-muted-foreground">
          Des offres adaptées à votre formation et à votre ville, une fiche sur chaque employeur, et
          votre lettre de motivation ajustée à chaque offre, sans jamais rien inventer.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Créer mon compte gratuitement
          </Link>
          <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Se connecter
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Gratuit pendant la bêta. Aucune carte bancaire demandée.
        </p>
      </section>
      <section className="grid gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Comment ça marche</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="grid gap-2 rounded-xl border p-5">
              <span className="text-sm text-muted-foreground">Étape {index + 1}</span>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="grid gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Nos engagements</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <li key={principle.title} className="grid gap-2">
              <h3 className="font-medium">{principle.title}</h3>
              <p className="text-sm text-muted-foreground">{principle.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

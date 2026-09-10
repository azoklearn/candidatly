import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">{APP_NAME}</p>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Trouvez votre alternance et envoyez des candidatures qui vous ressemblent.
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">
        Des offres adaptées à votre formation et à votre ville, une fiche sur chaque employeur, et
        votre lettre de motivation ajustée à chaque offre, sans jamais rien inventer.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/signup" className={buttonVariants({ size: "lg" })}>
          Créer un compte
        </Link>
        <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Se connecter
        </Link>
      </div>
    </main>
  );
}

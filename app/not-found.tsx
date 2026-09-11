import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="brand-mark" aria-hidden>
        C
      </span>
      <h1 className="page-title">
        Page <em>introuvable</em>
      </h1>
      <p className="text-muted-foreground">Cette page n’existe pas ou a été déplacée.</p>
      <Link href="/" className={buttonVariants()}>
        Retour à l’accueil
      </Link>
    </main>
  );
}

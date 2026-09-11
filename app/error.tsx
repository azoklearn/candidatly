"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

/** Next.js 16 error boundary: retry() re-fetches the segment and renders it again. */
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto grid w-full max-w-xl gap-4 px-6 py-16">
      <h1 className="page-title">
        Un petit <em>contretemps</em>
      </h1>
      <p className="text-muted-foreground">
        Nous n’avons pas pu afficher cette page. Réessayez dans un instant ; si le problème
        continue, revenez plus tard.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => retry()}>
          Réessayer
        </Button>
        <Link href="/offers" className={buttonVariants({ variant: "outline" })}>
          Retour aux offres
        </Link>
      </div>
    </main>
  );
}

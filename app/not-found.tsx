import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="text-muted-foreground">Cette page n’existe pas ou a été déplacée.</p>
      <Link href="/" className="underline underline-offset-4">
        Retour à l’accueil
      </Link>
    </main>
  );
}

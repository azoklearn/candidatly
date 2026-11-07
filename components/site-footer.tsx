import Link from "next/link";

import { APP_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--pastel-line)]">
      <div className="mx-auto grid w-full max-w-5xl gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <p className="text-base font-bold tracking-[-0.045em] text-foreground">{APP_NAME}</p>
        </div>
        <nav aria-label="Informations légales" className="flex flex-wrap gap-4">
          <Link href="/tarifs" className="nav-sweep hover:text-foreground">
            Tarifs
          </Link>
          <Link href="/mentions-legales" className="nav-sweep hover:text-foreground">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="nav-sweep hover:text-foreground">
            Confidentialité
          </Link>
          <Link href="/conditions" className="nav-sweep hover:text-foreground">
            Conditions d’utilisation
          </Link>
        </nav>
      </div>
    </footer>
  );
}

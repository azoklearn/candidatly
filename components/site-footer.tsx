import Link from "next/link";

import { APP_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-5xl gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <p className="font-medium text-foreground">{APP_NAME}</p>
          <p>Offres : La bonne alternance, via l’API Alternance.</p>
          <p>Entreprises : Annuaire des Entreprises (INSEE, INPI), Licence Ouverte 2.0.</p>
        </div>
        <nav aria-label="Informations légales" className="flex flex-wrap gap-4">
          <Link href="/mentions-legales" className="hover:text-foreground">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="hover:text-foreground">
            Confidentialité
          </Link>
          <Link href="/conditions" className="hover:text-foreground">
            Conditions d’utilisation
          </Link>
        </nav>
      </div>
    </footer>
  );
}

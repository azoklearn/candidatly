import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLink } from "@/components/brand-link";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="app-washes" aria-hidden />
      <div className="app-grain" aria-hidden />
      {/* Same header as the landing page: swept links and the shiny call to action. */}
      <header className="sticky top-0 z-40 px-3 pt-3">
        <div className="glass-bar mx-auto flex h-[3.75rem] w-full max-w-6xl items-center gap-x-6 pr-2.5 pl-5">
          <BrandLink />
          <nav
            aria-label="Navigation"
            className="ml-auto flex items-center gap-5 text-[0.8125rem] sm:gap-7"
          >
            <Link href="/tarifs" className="nav-sweep text-muted-foreground hover:text-foreground">
              Tarifs
            </Link>
            <Link href="/login" className="nav-sweep text-muted-foreground hover:text-foreground">
              Se connecter
            </Link>
            {/* Wrapped: the button's own inline-flex would override `hidden` on phones. */}
            <span className="hidden sm:inline-flex">
              <Link
                href="/onboarding/1"
                className={
                  buttonVariants({ variant: "default", size: "lg" }) + " h-10 px-5 text-sm"
                }
              >
                Trouver mon stage/alternance
              </Link>
            </span>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

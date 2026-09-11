import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLink } from "@/components/brand-link";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="app-grain" aria-hidden />
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <BrandLink />
          <nav aria-label="Navigation" className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/tarifs" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Tarifs
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Se connecter
            </Link>
            {/* Wrapped: the button's own inline-flex would override `hidden` on phones. */}
            <span className="hidden sm:inline-flex">
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
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

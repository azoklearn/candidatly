import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <nav aria-label="Accès au compte" className="ml-auto flex gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Se connecter
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

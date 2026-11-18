import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLink } from "@/components/brand-link";
import { currentUserId } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** The questionnaire is open to visitors (docs/QUESTIONS.md C91), who may already have an account. */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const signedIn = isSupabaseConfigured()
    ? (await currentUserId(await createClient())) !== null
    : false;
  return (
    <div className="min-h-svh">
      <div className="app-washes" aria-hidden />
      <div className="app-grain" aria-hidden />
      <header className="mx-auto w-full max-w-2xl px-3 pt-3 sm:px-4 sm:pt-5">
        <div className="glass-bar flex h-14 items-center justify-between pr-2 pl-4">
          <BrandLink />
          {signedIn ? null : (
            <Link
              href="/login"
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground"
            >
              Se connecter
            </Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

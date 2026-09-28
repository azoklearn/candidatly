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
      <div className="app-grain" aria-hidden />
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-6">
        <BrandLink />
        {signedIn ? null : (
          <Link
            href="/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Se connecter
          </Link>
        )}
      </header>
      {children}
    </div>
  );
}

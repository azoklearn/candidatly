import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-header";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/** Pages that require a completed onboarding (brief section 5.1). */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("onboarding_completed, first_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    logger.error("profile_load_failed", { code: error.code });
    throw new Error("Profile could not be loaded");
  }
  if (!profile?.onboarding_completed) redirect("/onboarding/1");

  return (
    <div className="min-h-svh">
      <AppHeader firstName={profile.first_name} />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

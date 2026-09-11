import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Signed-in area. The proxy already redirects visitors; this is the server-side check. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/login?error=config");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return (
    <>
      <div className="app-grain" aria-hidden />
      {children}
    </>
  );
}

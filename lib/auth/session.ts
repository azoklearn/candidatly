import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import type { Database } from "@/lib/supabase/database.types";

/** The signed-in user's id, verified from the JWT; redirects to /login otherwise. */
export async function requireUserId(supabase: SupabaseClient<Database>): Promise<string> {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");
  return userId;
}

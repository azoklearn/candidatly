import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service client with the secret key: it bypasses RLS. Only for jobs, webhooks and
 * server code that filters by user_id explicitly. Never import it in client code.
 */
export function createAdminClient() {
  const env = getSupabaseAdminEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

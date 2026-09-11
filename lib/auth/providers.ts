import { z } from "zod";

import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { fetchJson, type FetchLike } from "@/lib/http/fetch-json";
import { logger } from "@/lib/logger";

/**
 * Sign-in methods the Supabase project really offers (public GET /auth/v1/settings), so
 * the Google button only shows once Google is enabled there (docs/QUESTIONS.md C75).
 */

const SettingsSchema = z.object({
  external: z.object({ google: z.boolean().optional() }).catch({}),
});
const CACHE_MS = 5 * 60 * 1000;
let cached: { value: boolean; at: number } | null = null;

export function resetAuthSettingsCache(): void {
  cached = null;
}

export async function isGoogleSignInEnabled(
  options: {
    fetchImpl?: FetchLike;
    now?: number;
    /** Tests pass the project here; null means "not configured". Defaults to lib/env. */
    config?: { url: string; key: string } | null;
  } = {},
): Promise<boolean> {
  const config =
    options.config === undefined
      ? isSupabaseConfigured()
        ? {
            url: getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
            key: getPublicEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          }
        : null
      : options.config;
  if (!config) return false;
  const now = options.now ?? Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  try {
    const { data } = await fetchJson({
      source: "supabase-auth",
      url: new URL("/auth/v1/settings", config.url),
      schema: SettingsSchema,
      headers: { apikey: config.key },
      timeoutMs: 3_000,
      retry: { maxRetries: 0 },
      fetchImpl: options.fetchImpl,
    });
    const value = data.external.google === true;
    cached = { value, at: now };
    return value;
  } catch (error) {
    logger.warn("auth_settings_unavailable", { area: "auth", error });
    return false;
  }
}

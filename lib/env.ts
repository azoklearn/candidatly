import { z } from "zod";

import { ConfigError } from "@/lib/errors";

/**
 * Environment variables, validated with Zod. Each group is parsed on first use,
 * so the app can boot before every account (Stripe, Anthropic...) exists.
 * This is the only module allowed to read process.env.
 */

type EnvSource = Record<string, string | undefined>;

/** Empty strings count as missing, so `FOO=` in a .env file falls back to the default. */
function withoutEmptyStrings(source: EnvSource): EnvSource {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
}

function parseGroup<T extends z.ZodType>(group: string, schema: T, source: EnvSource): z.output<T> {
  const result = schema.safeParse(withoutEmptyStrings(source));
  if (result.success) return result.data;
  const variables = [
    ...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "")).filter(Boolean)),
  ];
  throw new ConfigError(
    `Missing or invalid environment variables (${group}): ${variables.join(", ")}`,
    variables,
  );
}

function memoize<T>(factory: () => T): () => T {
  let cached: { value: T } | null = null;
  return () => {
    cached ??= { value: factory() };
    return cached.value;
  };
}

// Public variables. Next.js inlines them in the browser bundle, which requires
// the literal `process.env.NEXT_PUBLIC_...` accesses below.
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});
export type PublicEnv = z.output<typeof PublicEnvSchema>;

export function parsePublicEnv(source: EnvSource): PublicEnv {
  return parseGroup("public", PublicEnvSchema, source);
}

export const getPublicEnv = memoize(() =>
  parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  }),
);

export function isSupabaseConfigured(): boolean {
  try {
    getPublicEnv();
    return true;
  } catch {
    return false;
  }
}

// Server-only groups: never import their getters from client components.
const SupabaseAdminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});
export type SupabaseAdminEnv = z.output<typeof SupabaseAdminEnvSchema>;

export function parseSupabaseAdminEnv(source: EnvSource): SupabaseAdminEnv {
  return parseGroup("supabase-admin", SupabaseAdminEnvSchema, source);
}

export const getSupabaseAdminEnv = memoize(() => parseSupabaseAdminEnv(process.env));

const ApiAlternanceEnvSchema = z.object({
  API_ALTERNANCE_KEY: z.string().min(20),
  API_ALTERNANCE_BASE_URL: z.url().default("https://api.apprentissage.beta.gouv.fr/api"),
});
export type ApiAlternanceEnv = z.output<typeof ApiAlternanceEnvSchema>;

export function parseApiAlternanceEnv(source: EnvSource): ApiAlternanceEnv {
  return parseGroup("api-alternance", ApiAlternanceEnvSchema, source);
}

export const getApiAlternanceEnv = memoize(() => parseApiAlternanceEnv(process.env));

const GeocodingEnvSchema = z.object({
  GEOCODING_API_BASE_URL: z.url().default("https://data.geopf.fr/geocodage"),
});
export type GeocodingEnv = z.output<typeof GeocodingEnvSchema>;

export function parseGeocodingEnv(source: EnvSource): GeocodingEnv {
  return parseGroup("geocoding", GeocodingEnvSchema, source);
}

export const getGeocodingEnv = memoize(() => parseGeocodingEnv(process.env));

const AnthropicEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL_LETTER: z.string().min(1).default("claude-sonnet-5"),
  ANTHROPIC_MODEL_LIGHT: z.string().min(1).default("claude-haiku-4-5-20251001"),
});
export type AnthropicEnv = z.output<typeof AnthropicEnvSchema>;

export function parseAnthropicEnv(source: EnvSource): AnthropicEnv {
  return parseGroup("anthropic", AnthropicEnvSchema, source);
}

export const getAnthropicEnv = memoize(() => parseAnthropicEnv(process.env));

export function isAnthropicConfigured(): boolean {
  try {
    getAnthropicEnv();
    return true;
  } catch {
    return false;
  }
}

const TriggerEnvSchema = z.object({ TRIGGER_SECRET_KEY: z.string().min(1) });

/** Trigger.dev reads TRIGGER_SECRET_KEY itself; without it, jobs run inline (local development). */
export function isTriggerConfigured(): boolean {
  return TriggerEnvSchema.safeParse(withoutEmptyStrings(process.env)).success;
}

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevelName = (typeof LOG_LEVELS)[number];

export function getLogLevel(): LogLevelName {
  const value = process.env.LOG_LEVEL;
  const known = LOG_LEVELS.find((level) => level === value);
  if (known) return known;
  return process.env.NODE_ENV === "test" ? "warn" : "info";
}

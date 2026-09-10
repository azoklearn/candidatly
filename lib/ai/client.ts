import Anthropic from "@anthropic-ai/sdk";

import { getAnthropicEnv, isAnthropicConfigured } from "@/lib/env";

let client: Anthropic | null = null;

/** Shared Anthropic client (server side only), or null when no API key is configured. */
export function getAnthropicClient(): Anthropic | null {
  if (!isAnthropicConfigured()) return null;
  client ??= new Anthropic({
    apiKey: getAnthropicEnv().ANTHROPIC_API_KEY,
    maxRetries: 2,
    timeout: 60_000,
  });
  return client;
}

/** Model identifiers, configurable without a code change (CLAUDE.md, Appels Anthropic). */
export function getModels(): { letter: string; light: string } {
  if (!isAnthropicConfigured()) {
    return { letter: "claude-sonnet-5", light: "claude-haiku-4-5-20251001" };
  }
  const env = getAnthropicEnv();
  return { letter: env.ANTHROPIC_MODEL_LETTER, light: env.ANTHROPIC_MODEL_LIGHT };
}

import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { logger as defaultLogger, type Logger } from "@/lib/logger";
import { tokenize } from "@/lib/text/french";

/**
 * Step 3 of the onboarding (brief section 5.1): free text to 3 to 5 ROME codes.
 * The model may only pick among candidates found in the official nomenclature
 * (search_rome_candidates), so it cannot invent a code (docs/ROME.md section 11.3).
 */

export type RomeCandidate = { code: string; label: string; appellations: string[]; rank: number };
export type RomeSuggestion = { code: string; label: string; reason: string };
export type RomeSuggestions = {
  suggestions: RomeSuggestion[];
  source: "llm" | "search";
  usage?: { inputTokens: number; outputTokens: number };
};

const MAX_CANDIDATES = 30;
const MAX_SUGGESTIONS = 5;

const OutputSchema = z.object({
  codes: z.array(z.object({ code: z.string(), reason: z.string() })),
});

const SYSTEM_PROMPT = `Tu aides un étudiant français à choisir les métiers, identifiés par leurs codes ROME, qui correspondent au domaine ou à la formation qu'il décrit, pour chercher une alternance.
Règles absolues :
1. Choisis entre 3 et 5 codes, uniquement dans la liste de candidats fournie. N'invente jamais de code.
2. Classe-les du plus pertinent au moins pertinent pour une alternance à ce niveau d'études.
3. Pour chaque code, donne une raison en français, en une phrase de 15 mots au plus, factuelle, sans formule creuse.
4. Si aucun candidat ne convient, renvoie une liste vide.`;

/** Search terms for search_rome_candidates: accent-free words, no stop words, at most 12. */
export function toSearchTerms(text: string): string[] {
  return [...new Set(tokenize(text, 3))].slice(0, 12);
}

function fallbackSuggestions(candidates: RomeCandidate[]): RomeSuggestions {
  return {
    source: "search",
    suggestions: candidates.slice(0, MAX_SUGGESTIONS).map((candidate) => ({
      code: candidate.code,
      label: candidate.label,
      reason:
        candidate.appellations.length > 0
          ? `Proche de : ${candidate.appellations.slice(0, 2).join(", ")}.`
          : "Correspond aux mots de votre description.",
    })),
  };
}

export async function suggestRomeCodes(
  input: { text: string; candidates: RomeCandidate[]; diplomaLabel?: string | null },
  deps: { client: Anthropic | null; model: string; logger?: Logger },
): Promise<RomeSuggestions> {
  const candidates = input.candidates.slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return { suggestions: [], source: "search" };
  if (!deps.client) return fallbackSuggestions(candidates);

  const log = (deps.logger ?? defaultLogger).child({ task: "rome_mapping" });
  const byCode = new Map(candidates.map((candidate) => [candidate.code, candidate]));
  const prompt = [
    `Description de l'étudiant : """${input.text.trim().slice(0, 1_000)}"""`,
    input.diplomaLabel ? `Niveau du diplôme préparé : ${input.diplomaLabel}` : null,
    "Candidats (code | intitulé | exemples d'appellations) :",
    ...candidates.map(
      (candidate) =>
        `- ${candidate.code} | ${candidate.label} | ${candidate.appellations.slice(0, 3).join(" ; ")}`,
    ),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  // One automatic retry when the output is unusable (CLAUDE.md, gestion des erreurs).
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const message = await deps.client.messages.parse({
        model: deps.model,
        max_tokens: 800,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(OutputSchema) },
      });
      const seen = new Set<string>();
      const suggestions = (message.parsed_output?.codes ?? []).flatMap((pick) => {
        const candidate = byCode.get(pick.code.trim());
        if (!candidate || seen.has(candidate.code)) return [];
        seen.add(candidate.code);
        return [
          {
            code: candidate.code,
            label: candidate.label,
            reason: pick.reason.trim().slice(0, 200),
          },
        ];
      });
      if (suggestions.length > 0) {
        return {
          source: "llm",
          suggestions: suggestions.slice(0, MAX_SUGGESTIONS),
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
          },
        };
      }
      log.warn("invalid_output", { attempt, returned: message.parsed_output?.codes.length ?? 0 });
    } catch (error) {
      log.warn("call_failed", { attempt, error });
    }
  }
  return fallbackSuggestions(candidates);
}

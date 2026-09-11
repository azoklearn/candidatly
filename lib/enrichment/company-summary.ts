import { z } from "zod";

/**
 * Company summary without a language model (docs/QUESTIONS.md B11). Same shape as brief
 * section 6.2 so a model can take over later. Every sentence comes from the registry, the
 * company's own website description or the recruiter's text in the offer. Nothing notable
 * is claimed without a source: `recent_or_notable` stays empty, and the card says so.
 */

export const CompanySummarySchema = z.object({
  what_they_do: z.string(),
  what_they_do_source: z.enum(["website", "offer", "registry", "none"]),
  size_and_context: z.string(),
  recent_or_notable: z.array(z.string()).max(3),
  hooks_for_candidate: z.array(z.string()).max(3),
  sources: z.array(z.string()),
  generator: z.enum(["rules", "llm"]),
});
export type CompanySummary = z.infer<typeof CompanySummarySchema>;

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);
const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_match, separator: string, letter: string) => separator + letter.toUpperCase(),
    );

/** At most two sentences and 320 characters, cut on a sentence boundary when possible. */
export function firstSentences(text: string, maxSentences = 2, maxChars = 320): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…]+$/g) ?? [clean];
  let output = "";
  for (const sentence of sentences.slice(0, maxSentences)) {
    const next = `${output} ${sentence.trim()}`.trim();
    if (next.length > maxChars) break;
    output = next;
  }
  if (output) return output;
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1).trimEnd()}…` : clean;
}

export type CompanySummaryInput = {
  nafLabel: string | null;
  headcountLabel: string | null;
  creationYear: number | null;
  city: string | null;
  website: { description: string | null; sources: string[] } | null;
  offerDescription: string | null;
};

export function buildCompanySummary(input: CompanySummaryInput): CompanySummary {
  let whatTheyDo = "";
  let source: CompanySummary["what_they_do_source"] = "none";
  const websiteDescription = input.website?.description?.trim() ?? "";
  const offerDescription = input.offerDescription?.trim() ?? "";
  if (websiteDescription.length >= 40) {
    whatTheyDo = firstSentences(websiteDescription);
    source = "website";
  } else if (offerDescription.length >= 40) {
    whatTheyDo = firstSentences(offerDescription);
    source = "offer";
  } else if (input.nafLabel) {
    whatTheyDo = `Activité déclarée : ${lowerFirst(input.nafLabel)}.`;
    source = "registry";
  }

  const size = input.headcountLabel
    ? input.headcountLabel.startsWith("sans")
      ? `Entreprise ${input.headcountLabel}`
      : `Entreprise de ${input.headcountLabel}`
    : null;
  const parts = [
    size ?? "Entreprise",
    input.creationYear ? `créée en ${input.creationYear}` : null,
    input.city ? `basée à ${titleCase(input.city)}` : null,
  ].filter((part): part is string => Boolean(part));
  const sizeAndContext = parts.length > 1 || size ? `${parts.join(", ")}.` : "";

  const hooks = [
    input.nafLabel
      ? `Relier votre formation à son activité : ${lowerFirst(input.nafLabel)}.`
      : null,
    input.website
      ? "Citer un élément précis de sa présentation en ligne (voir les sources)."
      : null,
    offerDescription.length >= 40
      ? "Reprendre un point de la présentation de l'entreprise dans l'offre."
      : null,
  ].filter((hook): hook is string => Boolean(hook));

  return {
    what_they_do: whatTheyDo,
    what_they_do_source: source,
    size_and_context: sizeAndContext,
    recent_or_notable: [],
    hooks_for_candidate: hooks.slice(0, 3),
    sources: input.website?.sources ?? [],
    generator: "rules",
  };
}

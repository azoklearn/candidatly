import { STUDY_LEVEL_LABELS } from "@/lib/format";
import { PRESET_CITIES, type PresetCity } from "@/lib/onboarding/cities";
import { extractKeywords } from "@/lib/matching/score";
import type { ProfileDiplomaLevel } from "@/lib/providers/types";

/**
 * What a CV tells us without any model (docs/QUESTIONS.md C95): the level of study, the
 * kind of contract looked for, the city and the words to search the ROME nomenclature
 * with. Everything found here is shown to the student, who can correct it in one click.
 */

export type ContractGuess = "alternance" | "stage" | "job_etudiant";

export type CvName = { firstName: string; lastName: string };

export type CvScan = {
  diplomaLevel: ProfileDiplomaLevel | null;
  contract: ContractGuess | null;
  city: PresetCity | null;
  name: CvName | null;
  email: string | null;
  terms: string[];
};

const LEVEL_RULES: readonly (readonly [RegExp, ProfileDiplomaLevel])[] = [
  [/\b(bac\s*\+\s*5|master\s*2|mast[eè]re|ing[ée]nieur|mba|dess|dea)\b/i, "bac+5"],
  [/\b(bac\s*\+\s*4|master\s*1|ma[iî]trise)\b/i, "bac+4"],
  [/\b(bac\s*\+\s*3|licence|bachelor|but\b)\b/i, "bac+3"],
  [/\b(bac\s*\+\s*2|bts|dut|deust)\b/i, "bac+2"],
  [/\bbac\b/i, "bac"],
];

/** A CV lists the whole path: the highest level mentioned is the one being prepared. */
export function detectDiplomaLevel(text: string): ProfileDiplomaLevel | null {
  for (const [pattern, level] of LEVEL_RULES) {
    if (pattern.test(text)) return level;
  }
  return null;
}

export function detectContract(text: string): ContractGuess | null {
  const alternance = /\b(alternance|alternant|apprentissage|apprenti|contrat\s+pro)/i.test(text);
  if (alternance) return "alternance";
  if (/\b(stage|stagiaire)\b/i.test(text)) return "stage";
  if (/\bjob\s+[ée]tudiant|temps\s+partiel\b/i.test(text)) return "job_etudiant";
  return null;
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Only the cities of the list: a wrong guess would send the search to the wrong place. */
export function detectCity(text: string): PresetCity | null {
  const haystack = fold(text);
  return (
    PRESET_CITIES.find((city) => new RegExp(`\\b${fold(city.label)}\\b`).test(haystack)) ?? null
  );
}

/** The words the ROME nomenclature is searched with: the most frequent ones of the CV. */
export function cvSearchTerms(text: string): string[] {
  return extractKeywords(text, { max: 10 });
}

/** Words that start a heading or a job title, never a name. */
const NOT_A_NAME =
  /(curriculum|vitae|^cv\b|[ée]tudiant|recherche|alternance|stage|apprenti|d[ée]veloppeu|ing[ée]nieu|assistant|charg[ée]|technicien|profil|contact|exp[ée]rience|formation|comp[ée]tence|langue|projet|permis)/i;

function titleCase(word: string): string {
  return word
    .toLocaleLowerCase("fr-FR")
    .replace(
      /(^|[-'’])(\p{L})/gu,
      (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase("fr-FR"),
    );
}

/**
 * The name written at the top of the CV, so the account form comes already filled. Two or
 * three capitalised words, in the first lines, away from any heading: anything else is
 * left to the student.
 */
export function detectName(text: string): CvName | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  for (const line of lines) {
    if (line.length > 40 || /[0-9@]/.test(line) || NOT_A_NAME.test(line)) continue;
    const words = line.split(/[\s,]+/).filter(Boolean);
    if (words.length < 2 || words.length > 3) continue;
    if (!words.every((word) => /^\p{Lu}[\p{L}'’-]+$/u.test(word))) continue;
    const [first, ...rest] = words;
    if (!first) continue;
    return { firstName: titleCase(first), lastName: rest.map(titleCase).join(" ") };
  }
  return null;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;

export function detectEmail(text: string): string | null {
  const found = text.match(EMAIL)?.[0] ?? null;
  return found ? found.replace(/[.,;]$/, "").toLowerCase() : null;
}

export function scanCvText(text: string): CvScan {
  return {
    diplomaLevel: detectDiplomaLevel(text),
    contract: detectContract(text),
    city: detectCity(text),
    name: detectName(text),
    email: detectEmail(text),
    terms: cvSearchTerms(text),
  };
}

export const CONTRACT_LABELS: Record<ContractGuess, string> = {
  alternance: "Alternance",
  stage: "Stage",
  job_etudiant: "Job étudiant",
};

/** One short line shown on the next screen: what the CV said, in the student's words. */
export function scanSummary(input: {
  diplomaLevel: ProfileDiplomaLevel | null;
  domainLabel: string | null;
  city: string | null;
}): string | null {
  const parts = [
    input.diplomaLevel ? STUDY_LEVEL_LABELS[input.diplomaLevel] : null,
    input.domainLabel,
    input.city,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

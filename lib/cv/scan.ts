import { PRESET_CITIES, type PresetCity } from "@/lib/onboarding/cities";
import { extractKeywords } from "@/lib/matching/score";
import type { ProfileDiplomaLevel } from "@/lib/providers/types";

/**
 * What a CV tells us without any model (docs/QUESTIONS.md C95): the level of study, the
 * kind of contract looked for, the city and the words to search the ROME nomenclature
 * with. Everything found here is shown to the student, who can correct it in one click.
 */

export type ContractGuess = "alternance" | "stage" | "job_etudiant";

export type CvScan = {
  diplomaLevel: ProfileDiplomaLevel | null;
  contract: ContractGuess | null;
  city: PresetCity | null;
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

export function scanCvText(text: string): CvScan {
  return {
    diplomaLevel: detectDiplomaLevel(text),
    contract: detectContract(text),
    city: detectCity(text),
    terms: cvSearchTerms(text),
  };
}

export const DIPLOMA_LABELS: Record<ProfileDiplomaLevel, string> = {
  bac: "Bac",
  "bac+2": "Bac+2",
  "bac+3": "Bac+3",
  "bac+4": "Bac+4",
  "bac+5": "Bac+5",
};

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
    input.diplomaLevel ? DIPLOMA_LABELS[input.diplomaLevel] : null,
    input.domainLabel,
    input.city,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

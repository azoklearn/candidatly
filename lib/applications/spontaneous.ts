/**
 * Unsolicited applications (docs/QUESTIONS.md C121): the student writes to a company of
 * their search that published no offer. Pure helpers; the letter itself is adapted by the
 * same rules as for an offer (lib/letters/adapt.ts).
 */

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * What makes two rows the same company for one student: its SIRET when it is known, its
 * name otherwise. One unsolicited application per company.
 */
export function companyKey(company: { siret?: string | null; name: string }): string | null {
  const digits = (company.siret ?? "").replace(/\D/g, "");
  if (digits.length === 14) return `siret:${digits}`;
  const name = fold(company.name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return name ? `name:${name.slice(0, 80)}` : null;
}

/** How the kind of contract reads after "Candidature spontanée". */
export function contractWords(contract: string | null | undefined): string {
  if (contract === "stage") return "pour un stage";
  if (contract === "job_etudiant") return "pour un job étudiant";
  if (contract === "both") return "en alternance ou en stage";
  return "en alternance";
}

/** "DÉVELOPPEUR / DÉVELOPPEUSE WEB" reads better in a letter as "développeur / développeuse web". */
export function tradeForLetter(label: string | null | undefined): string | null {
  const text = (label ?? "").trim();
  if (!text) return null;
  return text === text.toUpperCase() ? text.toLowerCase() : text;
}

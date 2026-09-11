import type { CompanyRecord, Establishment } from "./recherche-entreprises";

/**
 * Our own confidence score (brief section 3.2, docs/QUESTIONS.md C24): the API score is
 * raw and not comparable between queries. A SIRET match is certain; a name match needs a
 * similar name and an establishment in the offer's postal code.
 */

export const MIN_CONFIDENCE = 0.75;
const MIN_NAME_SIMILARITY = 0.6;
const NON_DIFFUSIBLE = "[NON-DIFFUSIBLE]";
const LEGAL_FORMS = new Set(
  "sa sas sasu sarl eurl sci snc scp selarl selas scop sca earl gaec eirl ei".split(" "),
);

export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token && !LEGAL_FORMS.has(token))
    .join(" ");
}

export function nameSimilarity(a: string, b: string): number {
  const x = normalizeCompanyName(a);
  const y = normalizeCompanyName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const tokensX = new Set(x.split(" "));
  const tokensY = new Set(y.split(" "));
  const common = [...tokensX].filter((token) => tokensY.has(token)).length;
  const dice = (2 * common) / (tokensX.size + tokensY.size);
  const compactX = x.replace(/ /g, "");
  const compactY = y.replace(/ /g, "");
  const contained =
    compactX.length >= 4 &&
    compactY.length >= 4 &&
    (compactX.includes(compactY) || compactY.includes(compactX));
  return Math.max(dice, contained ? 0.85 : 0);
}

const usable = (value: string | null | undefined): value is string =>
  Boolean(value) && !(value ?? "").includes(NON_DIFFUSIBLE);

export type CompanyMatch = {
  record: CompanyRecord;
  establishment: Establishment;
  confidence: number;
};

export function pickCompanyMatch(
  target: { siret: string | null; name: string | null; postalCode: string | null },
  results: CompanyRecord[],
): CompanyMatch | null {
  if (target.siret) {
    for (const record of results) {
      const establishments = [
        ...record.matching_etablissements,
        ...(record.siege ? [record.siege] : []),
      ];
      const establishment = establishments.find((candidate) => candidate.siret === target.siret);
      if (establishment) return { record, establishment, confidence: 1 };
    }
    return null;
  }
  const name = target.name;
  if (!name) return null;
  let best: CompanyMatch | null = null;
  for (const record of results) {
    const establishments = [
      ...record.matching_etablissements,
      ...(record.siege ? [record.siege] : []),
    ];
    const names = [
      record.nom_raison_sociale,
      record.nom_complet,
      record.sigle,
      ...establishments.flatMap((e) => [e.nom_commercial, ...e.liste_enseignes]),
    ].filter(usable);
    const similarity = Math.max(0, ...names.map((candidate) => nameSimilarity(name, candidate)));
    const local = target.postalCode
      ? establishments.find((e) => e.code_postal === target.postalCode)
      : undefined;
    const confidence = Math.round((0.7 * similarity + (local ? 0.3 : 0)) * 100) / 100;
    const establishment = local ?? record.siege ?? establishments[0];
    if (!establishment || similarity < MIN_NAME_SIMILARITY || confidence < MIN_CONFIDENCE) continue;
    if (!best || confidence > best.confidence) best = { record, establishment, confidence };
  }
  return best;
}

/** "[NON-DIFFUSIBLE]" values are masked data: never displayed (section 12.2). */
export function publicValue(value: string | null | undefined): string | null {
  return usable(value) ? value : null;
}

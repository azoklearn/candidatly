/**
 * Offers that are not a company hiring for itself (docs/QUESTIONS.md C120): a school that
 * manages the offer, a training body, a staffing or recruitment agency. They are hidden by
 * default and one setting shows them again. Rules only, read from what the offer says:
 * the "managed by a school" flag of the source, the activity code of the employer, and a
 * few unambiguous words of its name.
 *
 * No path alias here: scripts run this file with plain Node.
 */

export const NOISE_KINDS = ["school", "training", "staffing"] as const;
export type NoiseKind = (typeof NOISE_KINDS)[number];

export const NOISE_LABELS: Record<NoiseKind, string> = {
  school: "Offre gérée par une école",
  training: "Organisme de formation",
  staffing: "Agence d’intérim ou de recrutement",
};

/** NAF division 78: placement, temporary work, other human resources provision. */
const STAFFING_NAF = /^78/;
/** NAF division 85: education. */
const TRAINING_NAF = /^85/;

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Whole words only: "formation" matches "AUREIS FORMATION", not "Information Systems". */
const STAFFING_NAME =
  /\b(interim|interimaire|travail temporaire|adecco|manpower|randstad|synergie|proman|crit interim|start people|temporis|adequat|samsic emploi|supplay|gi group|kelly services|page personnel|hays|walters people|winsearch)\b/;
const TRAINING_NAME =
  /\b(ecole|school|campus|cfa|academy|academie|formation|formations|institut de formation|business school|centre de formation|organisme de formation|universite|lycee|iut|greta|afpa)\b/;

export function classifyNoise(offer: {
  isDelegated: boolean;
  nafCode?: string | null;
  companyName?: string | null;
}): NoiseKind | null {
  if (offer.isDelegated) return "school";
  const naf = (offer.nafCode ?? "").replace(/[^0-9A-Za-z]/g, "");
  const name = fold(offer.companyName ?? "");
  if (STAFFING_NAF.test(naf) || STAFFING_NAME.test(name)) return "staffing";
  if (TRAINING_NAF.test(naf) || TRAINING_NAME.test(name)) return "training";
  return null;
}

export function isNoiseKind(value: string | null | undefined): value is NoiseKind {
  return (NOISE_KINDS as readonly string[]).includes(value ?? "");
}

/**
 * Proof line of the landing page, built from real numbers only (docs/QUESTIONS.md C73).
 * The owner's sentence about students who found their placement shows up by itself once
 * it is true; until then a true sentence stands in.
 */

export const PLACED_THRESHOLD = 200;
export const SIGNED_UP_THRESHOLD = 100;

export type LandingStats = { placedStudents: number; students: number };

const formatCount = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

function rounded(value: number, step: number): { text: string; exact: boolean } {
  const floor = Math.floor(value / step) * step;
  return { text: formatCount(floor), exact: floor === value };
}

export function socialProofMessage(stats: LandingStats | null): string {
  if (stats && stats.placedStudents >= PLACED_THRESHOLD) {
    const count = rounded(stats.placedStudents, 100);
    return `${count.exact ? "" : "Plus de "}${count.text} étudiants ont trouvé leur stage ou leur alternance grâce à Candidatly.`;
  }
  if (stats && stats.students >= SIGNED_UP_THRESHOLD) {
    const count = rounded(stats.students, 50);
    return `${count.exact ? "Déjà" : "Déjà plus de"} ${count.text} étudiants utilisent Candidatly.`;
  }
  return "Les offres d’alternance officielles, triées pour ton profil.";
}

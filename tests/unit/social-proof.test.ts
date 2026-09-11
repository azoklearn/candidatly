import { describe, expect, it } from "vitest";

import { socialProofMessage } from "@/lib/social-proof";

const fr = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

describe("socialProofMessage", () => {
  it("claims placements only once more than 200 students really found one", () => {
    expect(socialProofMessage({ placedStudents: 237, students: 900 })).toBe(
      "Plus de 200 étudiants ont trouvé leur stage ou leur alternance grâce à Candidatly.",
    );
    expect(socialProofMessage({ placedStudents: 1_234, students: 5_000 })).toBe(
      `Plus de ${fr(1_200)} étudiants ont trouvé leur stage ou leur alternance grâce à Candidatly.`,
    );
    expect(socialProofMessage({ placedStudents: 200, students: 900 })).toBe(
      "200 étudiants ont trouvé leur stage ou leur alternance grâce à Candidatly.",
    );
  });

  it("falls back on true sentences before that", () => {
    expect(socialProofMessage({ placedStudents: 12, students: 130 })).toBe(
      "Déjà plus de 100 étudiants utilisent Candidatly.",
    );
    const fallback = "Les offres officielles de La bonne alternance, triées pour toi.";
    expect(socialProofMessage({ placedStudents: 0, students: 3 })).toBe(fallback);
    expect(socialProofMessage(null)).toBe(fallback);
  });
});

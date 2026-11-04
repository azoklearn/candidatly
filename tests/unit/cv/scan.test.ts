import { describe, expect, it } from "vitest";

import {
  cvSearchTerms,
  detectCity,
  detectContract,
  detectDiplomaLevel,
  scanCvText,
  scanSummary,
} from "@/lib/cv/scan";
import { bestDomainForCandidates } from "@/lib/onboarding/domains";

const CV = [
  "Camille Martin — 15 rue de la République, 69002 Lyon",
  "Étudiante en BUT Informatique, 3e année, à la recherche d’une alternance",
  "Compétences : développement web, React, TypeScript, PostgreSQL, Git",
  "2024 : stage de deux mois, développement d’une application interne",
  "Baccalauréat général mention bien, 2021",
].join("\n");

describe("reading a CV", () => {
  it("keeps the highest level of study mentioned", () => {
    expect(detectDiplomaLevel(CV)).toBe("bac+3");
    expect(detectDiplomaLevel("Master 2 Marketing, licence de gestion, bac ES")).toBe("bac+5");
    expect(detectDiplomaLevel("BTS Comptabilité, baccalauréat STMG")).toBe("bac+2");
    expect(detectDiplomaLevel("Rien sur les études")).toBeNull();
  });

  it("prefers the apprenticeship when the CV mentions several contracts", () => {
    expect(detectContract(CV)).toBe("alternance");
    expect(detectContract("Recherche un stage de fin d’études")).toBe("stage");
    expect(detectContract("Disponible pour un job étudiant le week-end")).toBe("job_etudiant");
    expect(detectContract("Développeur web")).toBeNull();
  });

  it("only recognises the cities of the list, accents or not", () => {
    expect(detectCity(CV)?.insee).toBe("69123");
    expect(detectCity("Habite à MONTPELLIER")?.id).toBe("montpellier");
    expect(detectCity("Habite à Guéret")).toBeNull();
  });

  it("keeps the words of the CV, not its punctuation", () => {
    const terms = cvSearchTerms(CV);
    expect(terms.length).toBeGreaterThan(2);
    expect(terms.every((term) => /^[\p{L}\p{N}]+$/u.test(term))).toBe(true);
  });

  it("reads a whole CV at once", () => {
    const scan = scanCvText(CV);
    expect(scan).toMatchObject({ diplomaLevel: "bac+3", contract: "alternance" });
    expect(scan.city?.label).toBe("Lyon");
  });

  it("writes the summary from what was found, and nothing else", () => {
    expect(scanSummary({ diplomaLevel: "bac+3", domainLabel: "Informatique", city: "Lyon" })).toBe(
      "Bac+3 · Informatique · Lyon",
    );
    expect(scanSummary({ diplomaLevel: null, domainLabel: null, city: "Lyon" })).toBe("Lyon");
    expect(scanSummary({ diplomaLevel: null, domainLabel: null, city: null })).toBeNull();
  });
});

describe("the field a CV points to", () => {
  it("takes the domain holding the most candidates, with the jobs of our list", () => {
    const best = bestDomainForCandidates([
      { code: "M1805", professionalDomain: "M18" },
      { code: "M1855", professionalDomain: "M18" },
      { code: "M1203", professionalDomain: "M12" },
    ]);
    expect(best?.domain.id).toBe("informatique");
    expect(best?.codes).toEqual(["M1805", "M1855"]);
  });

  it("keeps at most five jobs and gives nothing when no field matches", () => {
    const many = ["M1805", "M1855", "M1811", "M1819", "M1810", "M1816", "M1864", "M1886"].map(
      (code) => ({ code, professionalDomain: "M18" }),
    );
    expect(bestDomainForCandidates(many)?.codes).toHaveLength(5);
    expect(bestDomainForCandidates([{ code: "A1101", professionalDomain: "A11" }])).toBeNull();
    expect(bestDomainForCandidates([])).toBeNull();
  });
});

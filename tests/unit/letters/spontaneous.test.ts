import { describe, expect, it } from "vitest";

import { companyKey, contractWords, tradeForLetter } from "@/lib/applications/spontaneous";
import { adaptLetter } from "@/lib/letters/adapt";
import { followUpMessage } from "@/lib/letters/follow-up";

const BASE = [
  "Objet : Candidature pour une alternance",
  "",
  "Madame, Monsieur,",
  "",
  "Étudiante en troisième année de BUT Informatique, je souhaite rejoindre [entreprise] pour un poste de [poste] dès la rentrée. Mes projets en TypeScript, React et SQL m’ont appris à livrer des applications utiles et testées.",
  "",
  "Je vous prie d’agréer, Madame, Monsieur, mes salutations distinguées.",
  "",
  "Camille Testeur",
].join("\n");

const adapt = (title = "développeur web") =>
  adaptLetter({
    baseLetter: BASE,
    cvText: "Compétences : TypeScript, React, PostgreSQL",
    offer: { title, companyName: "Atelier Nova", city: "Lyon", skills: [], description: null },
    spontaneous: { contractWords: "en alternance" },
  });

describe("unsolicited application (C121)", () => {
  it("names the company and the trade the student aims at, and says so in the subject", () => {
    const result = adapt();
    expect(result.letter).toContain(
      "Objet : Candidature spontanée en alternance au poste de développeur web",
    );
    expect(result.letter).toContain(
      "je souhaite rejoindre Atelier Nova pour un poste de développeur web",
    );
    expect(result.changes.map((change) => change.reason)).toEqual([
      "Objet d'une candidature spontanée.",
      "Nom de l'entreprise visée par l'offre.",
      "Métier que vous visez, repris de votre profil.",
    ]);
  });

  it("invents nothing: no skill sentence without an offer, and it asks for a personal line", () => {
    const result = adapt();
    expect(result.letter).not.toMatch(/Votre offre cite/);
    expect(result.missing_info).toEqual([
      "Cette entreprise n'a pas publié d'offre : ajoutez une phrase sur ce qui vous attire chez elle.",
    ]);
  });

  it("still writes a subject when the profile has no trade", () => {
    const result = adapt("");
    expect(result.letter).toContain("Objet : Candidature spontanée en alternance\n");
    expect(result.missing_info.join(" ")).toMatch(/\[poste\]/);
  });

  it("adapts the follow-up to an application without an offer", () => {
    const message = followUpMessage({
      title: "développeur web",
      companyName: "Atelier Nova",
      sentAt: "2026-11-10T09:00:00Z",
      studentName: "Camille Testeur",
      spontaneous: { contractWords: "pour un stage" },
    });
    expect(message).toContain("Objet : Relance de ma candidature spontanée");
    expect(message).toContain(
      "je vous ai adressé une candidature spontanée pour un stage pour un poste de développeur web chez Atelier Nova.",
    );
    expect(message).toContain("Rejoindre votre équipe m'intéresse toujours");
    expect(message).not.toMatch(/Ce poste m'intéresse/);
  });

  it("keeps one application per company: by SIRET, or by name", () => {
    expect(companyKey({ siret: "123 456 789 00012", name: "Atelier Nova" })).toBe(
      "siret:12345678900012",
    );
    expect(companyKey({ siret: null, name: "Atelier  Nova (Lyon)" })).toBe(
      "name:atelier-nova-lyon",
    );
    expect(companyKey({ siret: "123", name: "Été & Cie" })).toBe("name:ete-cie");
    expect(companyKey({ siret: null, name: " " })).toBeNull();
  });

  it("words the contract and the trade for a letter", () => {
    expect(contractWords("alternance")).toBe("en alternance");
    expect(contractWords("stage")).toBe("pour un stage");
    expect(contractWords("job_etudiant")).toBe("pour un job étudiant");
    expect(contractWords(null)).toBe("en alternance");
    expect(tradeForLetter("DÉVELOPPEUR WEB")).toBe("développeur web");
    expect(tradeForLetter("Développeur / Développeuse web")).toBe("Développeur / Développeuse web");
    expect(tradeForLetter(" ")).toBeNull();
  });
});
